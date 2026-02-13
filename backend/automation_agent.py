
import os
import threading
import time
import datetime
import smtplib
from email.message import EmailMessage

# Standard event constants
EVENT_CRITICAL_RISK = "CRITICAL_RISK"
EVENT_HIGH_RISK = "HIGH_RISK"
EVENT_CAPACITY_EXCEEDED = "CAPACITY_EXCEEDED" 
EVENT_SURGE_DETECTED = "SURGE_DETECTED"
EVENT_PREDICTED_OVERFLOW = "PREDICTED_OVERFLOW"

def generate_events(zone_data):
    """
    Evaluates zone data against thresholds to generate a list of active events.
    """
    events = []

    # 1. CRI Thresholds
    if zone_data.get("cri", 0) >= 85:
        events.append(EVENT_CRITICAL_RISK)
    elif zone_data.get("cri", 0) >= 70:
        events.append(EVENT_HIGH_RISK)

    # 2. Capacity Check
    if zone_data.get("current_count", 0) > zone_data.get("capacity", 1):
        events.append(EVENT_CAPACITY_EXCEEDED)

    # 3. Surge
    if zone_data.get("surge_detected", False):
        events.append(EVENT_SURGE_DETECTED)

    # 4. Prediction
    if zone_data.get("forecast_30min", 0) > zone_data.get("capacity", 1):
        events.append(EVENT_PREDICTED_OVERFLOW)

    return events

class AutomationAgent:
    def __init__(self):
        self.cooldown_tracker = {} # Key: (zone_id, event_type) -> Value: timestamp
        self.COOLDOWN_SECONDS = 600 # 10 minutes
        self.log_file = os.path.join(os.path.dirname(__file__), 'logs', 'alerts.log')
        self.db_registrations = None # Will be set from app.py
        
        # Ensure logs directory exists
        self.COOLDOWN_SECONDS = 600 # 10 minutes
        self.log_file = os.path.join(os.path.dirname(__file__), 'logs', 'alerts.log')
        
        # Ensure logs directory exists
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
        
        # Email settings (Load from env or set defaults)
        self.email_host = os.getenv("EMAIL_HOST", "smtp.gmail.com")
        self.email_port = int(os.getenv("EMAIL_PORT", 587))
        self.email_user = os.getenv("EMAIL_USER", "") # Expects env var
        self.email_pass = os.getenv("EMAIL_PASS", "") # Expects env var

    def set_db_reference(self, registrations_collection):
        """Allows the agent to query the main database for subscribers."""
        self.db_registrations = registrations_collection

    def handle_events(self, zone_id, zone_data, events):
        """
        Main entry point. Iterates through events and handles them if not on cooldown.
        """
        if not events:
            return

        for event in events:
            if not self._is_on_cooldown(zone_id, event):
                # Process the event
                self._log_event(zone_id, event, zone_data)
                
                # Check specifics
                if event in [EVENT_CRITICAL_RISK, EVENT_CAPACITY_EXCEEDED, EVENT_SURGE_DETECTED]:
                    self._send_alert_email(zone_id, event, zone_data)
                
                # Update tracker
                self._update_cooldown(zone_id, event)

    def _is_on_cooldown(self, zone_id, event):
        key = (zone_id, event)
        last_time = self.cooldown_tracker.get(key)
        if last_time:
            elapsed = (datetime.datetime.now() - last_time).total_seconds()
            if elapsed < self.COOLDOWN_SECONDS:
                return True
        return False

    def _update_cooldown(self, zone_id, event):
        self.cooldown_tracker[(zone_id, event)] = datetime.datetime.now()

    def _log_event(self, zone_id, event, zone_data):
        """
         detailed log of the event
        """
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{now_str}] {zone_id} | {event} | CRI: {zone_data.get('cri')} | Count: {zone_data.get('current_count')} | Cap: {zone_data.get('capacity')}\n"
        
        print(f"🤖 [AutoAgent] {log_entry.strip()}")
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(log_entry)
        except Exception as e:
            print(f"   ⚠️ Log write failed: {e}")

    def _send_alert_email(self, zone_id, event, zone_data):
        """
        Sends an email in a separate thread.
        """
        if not self.email_user or not self.email_pass:
            print("   ⚠️ Email credentials missing. Skipping email.")
            return

        subject = f"CrowdSense Alert: {event} in {zone_data.get('zone_name', zone_id)}"
        body = f"""
        AUTOMATED ALERT FROM CROWDSENSE AGENT
        -------------------------------------
        Event: {event}
        Zone: {zone_data.get('zone_name', zone_id)} (ID: {zone_id})
        
        Metrics:
        - Risk Index (CRI): {zone_data.get('cri')}
        - Current Occupancy: {zone_data.get('current_count')} / {zone_data.get('capacity')}
        - Utilization: {int(zone_data.get('current_count',0)/max(zone_data.get('capacity',1),1)*100)}%
        - Surge Detected: {zone_data.get('surge_detected')}
        
        Time: {datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
        
        Please check the dashboard immediately.
        """
        
        # Recipient list - Fetch from MongoDB if available
        recipients = []
        if self.db_registrations:
            try:
                # Find approved contacts for this zone
                regs = list(self.db_registrations.find({"zone_id": zone_id, "status": { "$in": ["APPROVED", "PENDING"] }}))
                recipients = [r.get("contact_email") or r.get("user_email") for r in regs if r.get("contact_email") or r.get("user_email")]
            except Exception as e:
                print(f"   ⚠️ [AutoAgent] DB Fetch error: {e}")
        
        # Fallback to admin email if no subscribers found
        if not recipients and self.email_user:
            recipients = [self.email_user]
            
        if not recipients:
            print(f"   ⚠️ [AutoAgent] No recipients found for {zone_id}. Skipping email.")
            return

        def send():
            try:
                # Deduplicate recipients
                unique_recipients = list(set(recipients))
                
                msg = EmailMessage()
                msg.set_content(body)
                msg['Subject'] = subject
                msg['From'] = self.email_user
                msg['To'] = ", ".join(unique_recipients)

                with smtplib.SMTP(self.email_host, self.email_port) as server:
                    server.starttls()
                    server.login(self.email_user, self.email_pass)
                    server.send_message(msg)
                
                print(f"   📧 [AutoAgent] Email sent to {len(unique_recipients)} recipients for {zone_id}")
            except Exception as e:
                print(f"   ❌ [AutoAgent] Email failed: {e}")

        threading.Thread(target=send).start()
