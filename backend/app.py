"""
CrowdSense Backend — Flask API
Real-time crowd simulation + XGBoost ML predictions + CRI + Alerts
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import joblib
import numpy as np
import pandas as pd
import random
import datetime
import time
import math
import threading
import os
import requests
from pymongo import MongoClient
import json
from crowd_flow import flow_engine

# ─────────────────────────────────────────────
# Flask App Setup
# ─────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# ── Automation Agent Setup ──
from automation_agent import AutomationAgent, generate_events
automation_agent = AutomationAgent()

# MongoDB Setup
try:
    mongo_client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=2000)
    db = mongo_client['crowdsense']
    trend_collection = db['trends']
    log_collection = db['raw_logs'] 
    users_collection = db['users'] 
    registrations_collection = db['registrations'] # New: Event registrations
    alert_history_collection = db['alert_history'] # New: Manual alerts archive
    # Check connection
    mongo_client.server_info()
    print("🍃 MongoDB connected successfully!")
    USE_MONGO = True
    
    # Inject DB reference into Automation Agent
    automation_agent.set_db_reference(registrations_collection)
    
except Exception as e:
    print(f"⚠️ MongoDB not available, falling back to in-memory: {e}")
    USE_MONGO = False


# ─────────────────────────────────────────────
# Event & Alert Management Endpoints
# ─────────────────────────────────────────────

@app.route('/api/events/register', methods=['POST'])
def register_event():
    print("DEBUG: Incoming registration request")
    if not USE_MONGO:
        return jsonify({"message": "Demo: Registration received"}), 201
    
    data = request.json
    user_email = data.get('email')
    event_name = data.get('event_name')
    print(f"DEBUG: Data: {data}")
    
    # Prevent duplicate registrations
    existing = registrations_collection.find_one({
        "user_email": user_email,
        "event_name": event_name
    })
    if existing:
        return jsonify({"message": "You have already registered for this event.", "status": existing.get('status', 'PENDING')}), 409
    
    registration = {
        "user_email": user_email,
        "contact_email": data.get('contact_email'),
        "event_name": event_name,
        "zone_id": data.get('zone_id'),
        "status": "PENDING",
        "timestamp": datetime.datetime.now()
    }
    registrations_collection.insert_one(registration)
    print("DEBUG: Registration saved to MongoDB")
    return jsonify({"message": "Successfully registered for event. Waiting for admin approval."}), 201

@app.route('/api/events/update-status', methods=['POST'])
def update_registration_status():
    if not USE_MONGO:
        return jsonify({"message": "Status updated"}), 200
    
    data = request.json
    email = data.get('email')
    event_name = data.get('event_name')
    new_status = data.get('status') # APPROVED or REJECTED
    
    print(f"DEBUG UPDATE: email='{email}', event='{event_name}', new_status='{new_status}'")
    
    # Use update_many to catch ALL matching records (prevents stale duplicates)
    query = {"user_email": email, "event_name": event_name}
    result = registrations_collection.update_many(
        query,
        {"$set": {"status": new_status}}
    )
    
    print(f"DEBUG UPDATE RESULT: matched={result.matched_count}, modified={result.modified_count}")
    
    if result.matched_count == 0:
        # Maybe email was stored differently, try broader match
        query2 = {"event_name": event_name, "$or": [{"user_email": email}, {"contact_email": email}]}
        result2 = registrations_collection.update_many(query2, {"$set": {"status": new_status}})
        print(f"DEBUG UPDATE RETRY: matched={result2.matched_count}, modified={result2.modified_count}")
        
        if result2.matched_count == 0:
            return jsonify({"error": "Registration not found"}), 404
    
    return jsonify({"message": f"Registration {new_status}"}), 200

@app.route('/api/events/my-registrations/<email>', methods=['GET'])
def get_my_registrations(email):
    if not USE_MONGO:
        return jsonify([])
    
    # Show ALL registrations for the user (PENDING, APPROVED, REJECTED)
    regs = list(registrations_collection.find({
        "$or": [
            {"user_email": email},
            {"contact_email": email}
        ]
    }).sort("timestamp", -1))
    
    for r in regs:
        r.pop('_id')
        if isinstance(r.get('timestamp'), datetime.datetime):
            r['timestamp'] = r['timestamp'].isoformat()
            
    return jsonify(regs)

@app.route('/api/events/registrations', methods=['GET'])
def get_registrations():
    if not USE_MONGO:
        print("DEBUG: GET registrations called BUT Mongo is disabled")
        return jsonify([])
    
    # Admin gets details of all registrations (pending/approved/etc)
    regs = list(registrations_collection.find().sort("timestamp", -1))
    print(f"DEBUG: GET registrations found {len(regs)} records")
    for r in regs:
        r.pop('_id')
        if isinstance(r.get('timestamp'), datetime.datetime):
            r['timestamp'] = r['timestamp'].isoformat()
            
    return jsonify(regs)

@app.route('/api/zones/capacity', methods=['POST'])
def update_zone_capacity():
    """Allows admins to dynamically adjust the max capacity of a zone."""
    data = request.json
    zone_id = data.get('zone_id')
    new_capacity = data.get('capacity')
    
    if not zone_id or new_capacity is None:
        return jsonify({"error": "Missing zone_id or capacity"}), 400
    
    if zone_id in ZONES:
        ZONES[zone_id]['capacity'] = int(new_capacity)
        
        # Immediate recalculation so the NEXT poll is accurate
        if zone_id in live_data:
            current = live_data[zone_id]['current']
            predicted = live_data[zone_id]['predicted']
            # We don't have the full history here, so we use a safe growth rate of 0 for the instant calc
            new_cri = calculate_cri(current, ZONES[zone_id]['capacity'], predicted, 0, datetime.datetime.now().hour)
            new_risk = get_risk_level(new_cri)
            
            live_data[zone_id]['capacity'] = int(new_capacity)
            live_data[zone_id]['cri'] = new_cri
            live_data[zone_id]['risk_level'] = new_risk
            live_data[zone_id]['status'] = new_risk
        
        print(f"⚙️ Config & Live: {ZONES[zone_id]['name']} capacity updated to {new_capacity} (CRI Refreshed)")
        return jsonify({
            "message": f"Capacity for {ZONES[zone_id]['name']} updated to {new_capacity}",
            "zone_id": zone_id,
            "new_capacity": int(new_capacity),
            "instant_cri": live_data[zone_id]['cri'] if zone_id in live_data else None
        }), 200
    
    return jsonify({"error": "Zone not found"}), 404

@app.route('/api/alerts/send', methods=['POST'])
def send_manual_alert():
    if not USE_MONGO:
        return jsonify({"message": "Demo: Alert sent"}), 201
    
    data = request.json
    alert = {
        "title": data.get('title'),
        "message": data.get('message'),
        "level": data.get('level', 'INFO'),
        "zone_id": data.get('zone_id'),
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "created_at": datetime.datetime.now()
    }
    alert_history_collection.insert_one(alert)
    
    # Also push to the live alerts list (in-memory for real-time display)
    global alerts
    alerts.insert(0, alert)
    if len(alerts) > 50: alerts = alerts[:50]
    
    # Trigger n8n for manual alerts too
    if alert["level"] in ["WARNING", "CRITICAL"]:
        pass # Manual n8n removed. TODO: Add to Automation Agent manual handler if needed.
    
    return jsonify({"message": "Alert broadcasted successfully"}), 201

@app.route('/api/alerts/history', methods=['GET'])
def get_alert_history():
    if not USE_MONGO:
        return jsonify([])
    
    history = list(alert_history_collection.find().sort("created_at", -1).limit(100))
    for h in history:
        h.pop('_id')
        if isinstance(h.get('created_at'), datetime.datetime):
            h['created_at'] = h['created_at'].isoformat()
            
    return jsonify(history)

# ─────────────────────────────────────────────
# Authentication Endpoints
# ─────────────────────────────────────────────

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    if not USE_MONGO:
        return jsonify({"message": "Demo: Password reset successfully"}), 200
    
    data = request.json
    email = data.get('email', '').strip().lower()
    new_password = data.get('password')

    if not email.endswith('@vnrvjiet.in'):
        return jsonify({"error": "Only college emails allowed"}), 400

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "User not found"}), 404

    users_collection.update_one({"email": email}, {"$set": {"password": new_password}})
    return jsonify({"message": "Password updated successfully"}), 200

@app.route('/api/auth/register', methods=['POST'])
def register():
    if not USE_MONGO:
        return jsonify({"error": "Database not available"}), 503
    
    data = request.json
    email = data.get('email', '')
    password = data.get('password', '')

    if 'vnrvjiet.in' not in email:
        return jsonify({"error": "add college mail id error"}), 400

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 400

    users_collection.insert_one({"email": email, "password": password})
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    if not USE_MONGO:
        # Fallback for demo if mongo is down
        data = request.json
        if 'vnrvjiet.in' in data.get('email', ''):
            return jsonify({"message": "Logged in (Demo Mode)"}), 200
        return jsonify({"error": "add college mail id error"}), 400

    data = request.json
    email = data.get('email', '')
    password = data.get('password', '')

    if 'vnrvjiet.in' not in email:
        return jsonify({"error": "add college mail id error"}), 400

    user = users_collection.find_one({"email": email, "password": password})
    if user:
        return jsonify({"message": "Login successful", "user": {"email": email}}), 200
    
    return jsonify({"error": "Invalid credentials"}), 401

# ─────────────────────────────────────────────
# Load ML Model
# ─────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "smart_crowd_per_location_model.pkl")
model_bundle = None
models = None
label_encoder = None

try:
    model_bundle = joblib.load(MODEL_PATH)
    models = model_bundle["models"]           # dict: {location_id: XGBRegressor}
    label_encoder = model_bundle["label_encoder"]  # LabelEncoder for location names
    print(f"✅ ML Model loaded successfully!")
    print(f"   Locations: {list(label_encoder.classes_)}")
    print(f"   Model type: {type(list(models.values())[0]).__name__}")
except Exception as e:
    print(f"❌ Error loading ML model: {e}")
    print("   → Falling back to formula-based predictions")

# ─────────────────────────────────────────────
# Zone Configuration
# ─────────────────────────────────────────────
# Map the label encoder classes to frontend zone IDs
# LE_CLASSES: ['Canteen', 'D Block', 'Library', 'New Block', 'PG Block']
ZONE_NAME_TO_ID = {
    "Canteen": "canteen",
    "D Block": "dblock",
    "Library": "lib",
    "New Block": "newblock",
    "PG Block": "pg"
}

ZONES = {
    "canteen": {
        "name": "Student Canteen",
        "le_name": "Canteen",
        "capacity": 200,
        "base_density": 100,
        "coords": {"x": "43.1%", "y": "50.9%"},
        "type": "social"
    },
    "lib": {
        "name": "Main Library",
        "le_name": "Library",
        "capacity": 500,
        "base_density": 250,
        "coords": {"x": "41.6%", "y": "58.0%"},
        "type": "study"
    },
    "pg": {
        "name": "PG Block",
        "le_name": "PG Block",
        "capacity": 150,
        "base_density": 80,
        "coords": {"x": "39.8%", "y": "70.8%"},
        "type": "academic"
    },
    "newblock": {
        "name": "New Block",
        "le_name": "New Block",
        "capacity": 300,
        "base_density": 150,
        "coords": {"x": "48.1%", "y": "57.6%"},
        "type": "academic"
    },
    "dblock": {
        "name": "Academic Block D",
        "le_name": "D Block",
        "capacity": 400,
        "base_density": 200,
        "coords": {"x": "44.8%", "y": "73.6%"},
        "type": "academic"
    },
}

# ─────────────────────────────────────────────
# Shared State
# ─────────────────────────────────────────────
live_data = {}
alerts = []
history = {zone_id: [] for zone_id in ZONES}   # Rolling 30-step history per zone
trend_data = []  # Time-series history
current_flows = [] # Predicted/observed crowd flows between zones

# ─────────────────────────────────────────────
# Behavior-Driven Simulation Engine helpers
# ─────────────────────────────────────────────

def get_time_factor(hour, minute, weekday):
    """
    Returns the base multiplier for campus activity based on time and day.
    Sunday: Effectively closed (very low activity).
    """
    # ── Sunday Behavior ──
    if weekday == 6:  # 0=Monday, 6=Sunday
        return 0.1  # Flat low baseline for Sunday

    # ── Weekday Schedule ──
    t = hour + (minute / 60.0)

    # 1. Early Morning (6 - 8): Security & Early Staff
    if 6 <= t < 8:
        # Linear ramp from 0.1 to 0.3
        progress = (t - 6) / 2
        return 0.1 + (0.2 * progress)

    # 2. Arrival & Morning Classes (8 - 12)
    elif 8 <= t < 12:
        # Logistic-like S-curve for arrival
        if t < 9: return 0.3 + (0.7 * (t - 8)) # Fast ramp 8-9
        return 1.0 # Peak attendance

    # 3. Lunch Transitions (12 - 14)
    elif 12 <= t < 14:
        return 0.95 # Slight dip in overall activity as some leave/rest, but high movement

    # 4. Post-Lunch / Afternoon (14 - 18)
    elif 14 <= t < 18:
        # Slow decay
        return 0.9 - (0.1 * (t - 14) / 4)

    # 5. Evening / Cleaning Shift (18 - 20)
    elif 18 <= t < 20:
        # Bump for cleaning staff?
        # Simulation Rule: "Cleaning staff increase crowd 120 -> 200"
        # Relative to daytime peak (say 1000), 200 is 0.2. 120 is 0.12.
        # Let's say we hold a 'late stay' level.
        if t < 19: return 0.25 # 6-7 PM
        return 0.15 # 7-8 PM

    # 6. Night (20 - 6)
    else:
        return 0.1 # Stable overnight baseline

def get_zone_modifier(zone_type, hour, minute):
    """Returns zone-specific activity multipliers."""
    t = hour + (minute / 60.0)
    
    if zone_type == "social": # Canteen
        # Dead early
        if t < 8: return 0.1
        # Low morning
        if 8 <= t < 11: return 0.4
        # Lunch Spike (Bell curve centered at 13.0)
        if 11 <= t < 15:
            # Peak at 1 PM (13.0)
            delta = abs(t - 13.0)
            # Gaussian-ish shape
            spike = 2.5 * math.exp(-(delta**2) / 0.5) 
            return 0.5 + spike
        # Dead afternoon/evening
        if t >= 18: return 0.05
        return 0.3

    elif zone_type == "study": # Library
        # Moderate Morning
        if 9 <= t < 12: return 0.8
        # Dip during lunch
        if 12 <= t < 13: return 0.6 
        # Post-lunch High (Study time)
        if 14 <= t < 17: return 1.3
        # Evening stay
        if 17 <= t < 21: return 0.5
        return 0.2

    elif zone_type == "academic": # Classrooms
        # Morning classes
        if 9 <= t < 12: return 1.2
        # Lunch dip
        if 12 <= t < 13: return 0.5
        # Afternoon classes
        if 14 <= t < 17: return 1.0
        # Evening drop
        if t >= 17: return 0.1
        return 0.1
        
    return 1.0

# ─────────────────────────────────────────────
# Helper: CRI Calculation
# ─────────────────────────────────────────────
def calculate_cri(current, capacity, predicted, growth_rate, hour):
    """
    Crowd Risk Index (0–100).
    Weighted formula:
        40% — current density vs capacity
        25% — predicted density vs capacity  
        20% — growth rate (5-min)
        15% — time-of-day risk factor
    """
    density_ratio = min(current / max(capacity, 1), 2.0) # Increased cap to 200%
    predicted_ratio = min(predicted / max(capacity, 1), 1.5)

    # Time risk: higher during peak hours (but should not negate actual density)
    time_risk = 0.0
    if 12 <= hour <= 14:
        time_risk = 0.8
    elif 9 <= hour <= 11 or 14 < hour <= 16:
        time_risk = 0.5
    elif hour < 8 or hour > 19:
        time_risk = 0.1
    else:
        time_risk = 0.3

    # New Weighted Formula: 60% Density, 20% Predicted, 10% Growth, 10% Time
    cri = (
        (density_ratio * 60) +         # Heavy weight on actual density
        (predicted_ratio * 20) +       # Moderate predictive influence
        (min(max(growth_rate, 0), 1) * 10) +
        (time_risk * 10)
    )
    
    # HARD OVERRIDE: If actual count > capacity, enforce Critical status
    if current >= capacity:
        cri = max(cri, 85) # Force Critical
    elif current >= capacity * 0.9:
        cri = max(cri, 75) # Force Warning

    return min(max(round(cri), 0), 100)


def get_risk_level(cri):
    if cri >= 85:
        return "CRITICAL"
    elif cri >= 70:
        return "HIGH"
    elif cri >= 50:
        return "MODERATE"
    return "LOW"


# ─────────────────────────────────────────────
# Helper: Surge Detection
# ─────────────────────────────────────────────
def detect_surge(zone_history):
    """Detect surge if growth > 30% in last 5 readings, or Z-score > 2.5."""
    if len(zone_history) < 5:
        return False, 0.0

    recent = zone_history[-5:]
    older = zone_history[-10:-5] if len(zone_history) >= 10 else zone_history[:5]

    avg_recent = np.mean(recent)
    avg_older = np.mean(older) if len(older) > 0 else avg_recent

    growth_rate = (avg_recent - avg_older) / max(avg_older, 1)

    # Z-score based detection
    if len(zone_history) >= 10:
        mean_all = np.mean(zone_history)
        std_all = np.std(zone_history)
        if std_all > 0:
            z_score = (zone_history[-1] - mean_all) / std_all
            if z_score > 2.5:
                return True, growth_rate

    if growth_rate > 0.30:
        return True, growth_rate

    return False, growth_rate


# ─────────────────────────────────────────────
# Helper: Flow Vector Simulation
# ─────────────────────────────────────────────
def generate_flow_vector(zone_id, current_density, hour):
    """
    Simulate directional crowd movement between zones.
    Adds 'Travel Time' constraints and 'Night Lock' logic.
    """
    flows = []
    
    # ── 1. Activity Thresholds ──
    # If density is low (e.g. at night), movement is sparse/random, not directed flows.
    if current_density < 30 or (hour < 8 or hour > 19):
        return flows 

    # ── 2. Realistic Directed Flows (Core Schedule) ──
    # Library → Canteen during lunch
    if zone_id == "lib" and 11 <= hour <= 14:
        count = int(current_density * random.uniform(0.05, 0.15)) # Reduced for realism
        if count > 2:
            flows.append({"from_zone": "lib", "to_zone": "canteen", "count": count})

    # Canteen → D Block / PG Block after lunch
    if zone_id == "canteen" and 13 <= hour <= 15:
        count_d = int(current_density * random.uniform(0.05, 0.12))
        count_pg = int(current_density * random.uniform(0.02, 0.08))
        if count_d > 2:
            flows.append({"from_zone": "canteen", "to_zone": "dblock", "count": count_d})
        if count_pg > 2:
            flows.append({"from_zone": "canteen", "to_zone": "pg", "count": count_pg})

    # D Block → PG Block in evening
    if zone_id == "dblock" and 16 <= hour <= 18:
        count = int(current_density * random.uniform(0.08, 0.15))
        if count > 2:
            flows.append({"from_zone": "dblock", "to_zone": "pg", "count": count})

    return flows


# ─────────────────────────────────────────────
# ML Prediction
# ─────────────────────────────────────────────
def predict_with_model(zone_id, config, hour, weekday, is_weekend, rssi, current_density, zone_hist):
    """
    Use the XGBoost per-location model to predict density.
    Features: ['hour', 'weekday', 'rssi', 'value', 'prev_density',
               'prev2_density', 'rolling_mean_6', 'prev_day_density', 'is_weekend']
    """
    if models is None or label_encoder is None:
        # Fallback: formula-based prediction using behavior engine
        now = datetime.datetime.now()
        tf = get_time_factor(now.hour, now.minute, now.weekday())
        zm = get_zone_modifier(config.get("type"), now.hour, now.minute)
        return int(config["base_density"] * tf * zm * random.uniform(0.9, 1.15))

    le_name = config["le_name"]

    try:
        # Encode location to get the model index
        loc_encoded = label_encoder.transform([le_name])[0]
        model = models.get(loc_encoded)
        if model is None:
            # Fallback: formula-based prediction using behavior engine
            now = datetime.datetime.now()
            tf = get_time_factor(now.hour, now.minute, now.weekday())
            zm = get_zone_modifier(config.get("type"), now.hour, now.minute)
            return int(config["base_density"] * tf * zm * random.uniform(0.9, 1.15))

        # Build feature vector
        prev_density = zone_hist[-1] if len(zone_hist) >= 1 else current_density
        prev2_density = zone_hist[-2] if len(zone_hist) >= 2 else prev_density
        rolling_mean_6 = float(np.mean(zone_hist[-6:])) if len(zone_hist) >= 6 else float(np.mean(zone_hist)) if zone_hist else float(current_density)
        prev_day_density = zone_hist[-20] if len(zone_hist) >= 20 else current_density  # ~60 min ago as proxy

        features = pd.DataFrame([{
            "hour": hour,
            "weekday": weekday,
            "rssi": rssi,
            "value": config["capacity"],
            "prev_density": prev_density,
            "prev2_density": prev2_density,
            "rolling_mean_6": rolling_mean_6,
            "prev_day_density": prev_day_density,
            "is_weekend": is_weekend
        }])

        prediction = model.predict(features)[0]
        # Clamp to reasonable range
        prediction = max(0, min(int(prediction), int(config["capacity"] * 1.3)))
        
        # ── Post-Processing: Dampen & Blend ──
        # The ML model was trained on higher-density data. 
        # Blend it with current actual to keep it realistic.
        # Weight: 70% actual context, 30% raw ML prediction
        now = datetime.datetime.now()
        time_factor = get_time_factor(now.hour, now.minute, now.weekday())
        
        # Scale prediction by time factor (night predictions should be low)
        scaled_prediction = prediction * max(time_factor, 0.15)
        
        # Blend with current density for smoothness
        blended = (current_density * 0.7) + (scaled_prediction * 0.3)
        
        # Final clamp
        blended = max(0, min(int(blended), int(config["capacity"] * 1.2)))
        return blended

    except Exception as e:
        print(f"   ⚠️ Prediction error for {zone_id}: {e}")
        # Fallback: formula-based prediction using behavior engine
        now = datetime.datetime.now()
        tf = get_time_factor(now.hour, now.minute, now.weekday())
        zm = get_zone_modifier(config.get("type"), now.hour, now.minute)
        return int(config["base_density"] * tf * zm * random.uniform(0.9, 1.15))


# ─────────────────────────────────────────────
# Simulation State for Smooth Transitions
# We initialize it based on the current schedule to avoid "startup spikes"
class SimulationState:
    def __init__(self):
        # Initialize with baseline to avoid startup 0s
        self.counts = {zid: ZONES[zid]["base_density"] * 0.1 for zid in ZONES}

sim_state = SimulationState()

def simulator_loop():
    global live_data, alerts, history, trend_data
    print("🚀 Behavior-Driven Simulation Engine Started...")

    while True:
        try:
            now = datetime.datetime.now()
            hour = now.hour
            minute = now.minute
            weekday = now.weekday() # 0-6

            # 1. Global Time Factor
            global_factor = get_time_factor(hour, minute, weekday)
            
            new_state = {}
            temp_alerts = []

            for zone_id, config in ZONES.items():
                # 2. Zone Specific Modifier
                zone_mod = get_zone_modifier(config["type"], hour, minute)
                
                # 3. Calculate Target Density
                # Target = Base * GlobalTime * ZoneSpecific
                base = config["base_density"]
                target_raw = base * global_factor * zone_mod
                
                # Add randomness to target (not just noise, but "day-to-day variance")
                # We use a consistent random seed based on hour to keep it stable-ish per hour? 
                # No, just small random fluctuation in target is fine.
                target = target_raw * random.uniform(0.9, 1.1)

                # 4. Smooth Transition (Inertia)
                current = sim_state.counts[zone_id]
                
                # Distance to target
                diff = target - current
                
                # Move speed: How fast do we react?
                # Fast interactions (Lunch) vs Slow (Evening drain)
                if abs(diff) > 20: 
                    speed = 0.15 # Fast adjustment for big shifts
                else: 
                    speed = 0.05 # Slow drift for stability
                    
                # Apply movement
                next_val = current + (diff * speed)
                
                # 5. Noise / Micro-Fluctuations (Brownian Motion)
                # Keep it bounded: +/- 2 per cycle max, unless huge capacity
                noise = random.uniform(-1.5, 1.5)
                
                # Occasional minor surge (5% chance)
                if random.random() < 0.05:
                    noise += random.uniform(2, 5)

                next_val += noise
                
                # 6. Constraints & Clamping
                # Never negative
                next_val = max(0, next_val)
                # Cap at 150% capacity (safety buffer)
                next_val = min(next_val, config["capacity"] * 1.5)
                
                # Update State
                sim_state.counts[zone_id] = next_val
                
                # Final Integer Count for Display
                device_count = int(next_val)
                
                # ── 7. ML Pipeline Integration (Preserved) ──
                # We still run the ML model to get "Predicted" values for comparison
                # and to compute CRI as requested.
                zone_hist = history[zone_id]
                
                # Mock RSSI for API compatibility
                rssi = max(-90, min(-30, int(-80 + (device_count/config["capacity"])*30)))

                try:
                    # We pass the SIMULATED count as "current" to the ML model features
                    pred_density = predict_with_model(
                        zone_id, config, hour, weekday, (1 if weekday>=5 else 0),
                        rssi, device_count, zone_hist
                    )
                except:
                    pred_density = int(target) # Fallback to our sim target

                # ── 8. Estimated People (Natural Scaling) ──
                # Multiply by a factor (e.g. 1.3 devices per person? or 1 device = 1.3 people?)
                # Usually 1 device < 1 person if not everyone connects. 
                # But let's keep existing logic: 1.25-1.35 multiplier
                est_people = int(device_count * random.uniform(1.25, 1.35))

                # ── 5. Update history & Stats ──
                history[zone_id].append(device_count)
                if len(history[zone_id]) > 100:
                    history[zone_id] = history[zone_id][-100:]

                surge_flag, growth_rate = detect_surge(history[zone_id])
                # WE USE PREDICTED DENSITY FOR CRI
                cri = calculate_cri(device_count, config["capacity"], pred_density, growth_rate, hour)
                risk_level = get_risk_level(cri)
                flows = generate_flow_vector(zone_id, device_count, hour)

                # ── 5. Status colors (UI signals) ──
                if cri >= 70:
                    status_color = "text-red-500"
                elif cri >= 50:
                    status_color = "text-amber-500"
                else:
                    status_color = "text-green-500"

                # ── Store Result ──
                new_state[zone_id] = {
                    "id": zone_id,
                    "name": config["name"],
                    "current": device_count,
                    "capacity": config["capacity"],
                    "est_people": est_people,
                    "predicted": int(pred_density), # Use the ML prediction here
                    "cri": cri,
                    "risk_level": risk_level,
                    "surge": surge_flag,
                    "growth_rate": round(growth_rate * 100, 1),
                    "flows": flows,
                    "status": risk_level,
                    "statusColor": status_color,
                    "last_updated": now.strftime("%H:%M:%S")
                } 


                # ── 8. Alert Generation ──
                if cri >= 85:
                    # Find safest alternative zone
                    other_zones = [z for z in ZONES if z != zone_id]
                    alt_zone = random.choice(other_zones) if other_zones else None
                    temp_alerts.append({
                        "level": "CRITICAL",
                        "zone": config["name"],
                        "zone_id": zone_id,
                        "cri": cri,
                        "message": f"🔴 CRITICAL: {config['name']} at CRI {cri} — {device_count}/{config['capacity']} devices. Consider redirecting to {ZONES[alt_zone]['name']}." if alt_zone else f"🔴 CRITICAL: {config['name']} at CRI {cri}.",
                        "timestamp": now.strftime("%H:%M:%S")
                    })
                elif cri >= 70:
                    temp_alerts.append({
                        "level": "WARNING",
                        "zone": config["name"],
                        "zone_id": zone_id,
                        "cri": cri,
                        "message": f"🟠 WARNING: {config['name']} at CRI {cri} — approaching capacity.",
                        "timestamp": now.strftime("%H:%M:%S")
                    })
                
                # ── Automation Agent Integration ──
                # Gather data for the agent
                zone_data_for_agent = {
                    "zone_name": config["name"],
                    "current_count": device_count,
                    "capacity": config["capacity"],
                    "cri": cri,
                    "surge_detected": surge_flag,
                    "forecast_30min": int(pred_density)
                }
                
                # Run the agent in a separate thread just in case ensuring no block
                threading.Thread(target=lambda: automation_agent.handle_events(
                    zone_id, 
                    zone_data_for_agent, 
                    generate_events(zone_data_for_agent)
                )).start()


            # ── 8. Calculate Smart Crowd Flows ──
            current_flows = flow_engine.calculate_flows(new_state, hour)
            
            live_data = new_state
            alerts = temp_alerts

            # ── 9. High-Frequency Telemetry (Every 5 seconds) ──
            if USE_MONGO:
                try:
                    log_collection.insert_one({
                        "timestamp": now.strftime("%H:%M:%S"),
                        "created_at": now,
                        "zones": new_state,
                        "flows": current_flows,
                        "summary": {
                            "total_devices": sum(z["current"] for z in new_state.values()),
                            "total_people": sum(z["est_people"] for z in new_state.values()),
                            "avg_cri": round(sum(z["cri"] for z in new_state.values()) / len(new_state), 1)
                        }
                    })
                except Exception as e:
                    print(f"⚠️ MongoDB Raw Log Error: {e}")

            # ── 10. Record trend snapshot (Every Minute) ──
            last_record = trend_data[-1] if trend_data else None
            needs_record = False
            
            if not last_record:
                needs_record = True
            else:
                last_time = datetime.datetime.strptime(last_record["timestamp"], "%H:%M:%S")
                # Handle day rollover by checking minute difference
                if now.minute != last_time.minute:
                    needs_record = True

            if needs_record:
                zones_snap = {}
                for zid, zdata in new_state.items():
                    zones_snap[zid] = {
                        "actual": zdata["current"],
                        "predicted": zdata["predicted"],
                        "cri": zdata["cri"]
                    }
                
                snapshot = {
                    "timestamp": now.strftime("%H:%M:%S"),
                    "hour": now.strftime("%H:%M"),
                    "total_actual": sum(z["current"] for z in new_state.values()),
                    "total_predicted": sum(z["predicted"] for z in new_state.values()),
                    "avg_cri": round(sum(z["cri"] for z in new_state.values()) / len(new_state), 1),
                    "zones": zones_snap,
                    "created_at": now # For easier sorting/indexing
                }
                
                trend_data.append(snapshot)
                
                # Persistent storage in MongoDB
                if USE_MONGO:
                    try:
                        # Store in Trend Collection (Minute-by-minute stats)
                        trend_snap = snapshot.copy()
                        trend_snap["flows"] = current_flows # Add flows to trend for richer history
                        trend_collection.insert_one(trend_snap)
                    except Exception as e:
                        print(f"⚠️ MongoDB Trend Write Error: {e}")
                
                # Keep last 240 snapshots in memory for quick access
                if len(trend_data) > 240:
                    trend_data = trend_data[-240:]

            # Print summary
            summary = " | ".join([f"{z}: {d['current']}/{d['capacity']} CRI={d['cri']} P={d['predicted']}" for z, d in new_state.items()])
            print(f"[{now.strftime('%H:%M:%S')}] {summary}")

        except Exception as e:
            print(f"❌ Simulation error: {e}")
            import traceback
            traceback.print_exc()

        # Faster polling for snappy automation (4-6 seconds)
        time.sleep(random.uniform(4, 6))


# ─────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────
@app.route('/api/live', methods=['GET'])
def get_live_data():
    """Returns live data for all zones and crowd flows."""
    return jsonify({
        "zones": live_data,
        "flows": current_flows
    })


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Returns current active alerts."""
    return jsonify(alerts)


@app.route('/api/zone/<zone_id>', methods=['GET'])
def get_zone_data(zone_id):
    """Returns data for a specific zone."""
    data = live_data.get(zone_id)
    if data:
        return jsonify(data)
    return jsonify({"error": "Zone not found"}), 404


@app.route('/api/history/<zone_id>', methods=['GET'])
def get_zone_history(zone_id):
    """Returns density history for a zone (last 100 readings)."""
    hist = history.get(zone_id)
    if hist is not None:
        return jsonify({"zone_id": zone_id, "history": hist, "count": len(hist)})
    return jsonify({"error": "Zone not found"}), 404


@app.route('/api/summary', methods=['GET'])
def get_summary():
    """Returns aggregated summary metrics."""
    if not live_data:
        return jsonify({"error": "No data yet"}), 503

    zones = list(live_data.values())
    return jsonify({
        "total_devices": sum(z["current"] for z in zones),
        "total_people": sum(z["est_people"] for z in zones),
        "total_predicted": sum(z["predicted"] for z in zones),
        "avg_cri": round(sum(z["cri"] for z in zones) / len(zones), 1),
        "max_cri": max(z["cri"] for z in zones),
        "peak_zone": max(zones, key=lambda z: z["cri"])["name"],
        "alert_count": len(alerts),
        "zones_critical": sum(1 for z in zones if z["risk_level"] == "CRITICAL"),
        "zones_high": sum(1 for z in zones if z["risk_level"] == "HIGH"),
        "zones_moderate": sum(1 for z in zones if z["risk_level"] == "MODERATE"),
        "zones_low": sum(1 for z in zones if z["risk_level"] == "LOW"),
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
    })


@app.route('/api/trend', methods=['GET'])
def get_trend():
    """Returns time-series trend data for charts (actual vs predicted totals)."""
    if USE_MONGO:
        try:
            # Fetch last 240 from MongoDB
            cursor = trend_collection.find().sort("created_at", -1).limit(240)
            data = list(cursor)
            # Remove _id for JSON serializability
            for item in data:
                item.pop('_id', None)
                if 'created_at' in item:
                    item['created_at'] = item['created_at'].isoformat()
            return jsonify(data[::-1]) # Reverse to show chronologically
        except Exception as e:
            print(f"⚠️ MongoDB fetch error: {e}")
            
    return jsonify(trend_data)


@app.route('/api/forecast', methods=['GET'])
def get_forecast():
    """Predicts campus-wide density and crowd flows for a future time."""
    try:
        hour = request.args.get('hour', type=int)
        minute = request.args.get('minute', type=int, default=0)
        
        if hour is None or hour < 0 or hour > 23:
            return jsonify({"error": "Invalid hour (0-23 required)"}), 400
            
        t_mult = time_multiplier(hour, minute)
        forecast_state = {}
        
        for zid, config in ZONES.items():
            base = config["base_density"]
            z_mult = zonal_multiplier(config.get("type"), t_mult, hour)
            
            # Synthetic state for future time
            sim_count = int(base * z_mult)
            
            # Simplified growth rate for forecast
            growth = 0.03 if hour == 7 else 0.05 if (hour == 8 and minute < 30) else 0.0
            
            cri = calculate_cri(sim_count, config["capacity"], sim_count, growth, hour)
            risk = get_risk_level(cri)
            
            forecast_state[zid] = {
                "id": zid,
                "name": config["name"],
                "current": sim_count,
                "capacity": config["capacity"],
                "est_people": int(sim_count * 1.3),
                "predicted": sim_count,
                "cri": cri,
                "risk_level": risk,
                "status": risk,
                "statusColor": "text-red-500" if cri >= 70 else "text-amber-500" if cri >= 50 else "text-green-500"
            }
            
        flows = flow_engine.calculate_flows(forecast_state, hour)
        
        # Calculate a forecast summary
        zones_list = list(forecast_state.values())
        summary = {
            "total_devices": sum(z["current"] for z in zones_list),
            "total_people": sum(z["est_people"] for z in zones_list),
            "total_predicted": sum(z["predicted"] for z in zones_list),
            "avg_cri": round(sum(z["cri"] for z in zones_list) / len(zones_list), 1),
            "max_cri": max(z["cri"] for z in zones_list),
            "peak_zone": max(zones_list, key=lambda z: z["cri"])["name"],
            "alert_count": 0, # Forecasts don't trigger live alerts
            "is_forecast": True
        }
        
        return jsonify({
            "zones": forecast_state,
            "flows": flows,
            "summary": summary,
            "is_forecast": True,
            "forecast_time": f"{hour:02d}:{minute:02d}"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/forecast/24h/<zone_id>', methods=['GET'])
def get_zone_forecast_24h(zone_id):
    """Returns a full 24-hour forecast for a specific zone in one batch."""
    if zone_id not in ZONES:
        return jsonify({"error": "Zone not found"}), 404
    
    try:
        config = ZONES[zone_id]
        base = config["base_density"]
        full_day = []
        
        for h in range(24):
            t_mult = time_multiplier(h, 0)
            z_mult = zonal_multiplier(config.get("type"), t_mult, h)
            # Predicted value (integer)
            sim_count = int(base * z_mult)
            
            full_day.append({
                "hour": h,
                "predicted": sim_count,
                "current": sim_count,
                "load": round((sim_count / max(config["capacity"], 1)) * 100)
            })
            
        return jsonify(full_day)
    except Exception as e:
        print(f"Forecast Error: {e}")
        return jsonify({"error": str(e)}), 500



@app.route('/api/trend/<zone_id>', methods=['GET'])
def get_zone_trend(zone_id):
    """Returns time-series trend data for a specific zone."""
    if zone_id not in ZONES:
        return jsonify({"error": "Zone not found"}), 404
    
    source_data = trend_data
    if USE_MONGO:
        try:
            cursor = trend_collection.find().sort("created_at", -1).limit(240)
            source_data = list(cursor)[::-1]
        except Exception as e:
            print(f"⚠️ MongoDB zone fetch error: {e}")

    zone_trend = []
    for snap in source_data:
        z = snap["zones"].get(zone_id)
        if z:
            zone_trend.append({
                "timestamp": snap["timestamp"],
                "hour": snap["hour"],
                "actual": z["actual"],
                "predicted": z["predicted"],
                "cri": z["cri"]
            })
    return jsonify(zone_trend)


# ─────────────────────────────────────────────
# Start
# ─────────────────────────────────────────────
def seed_trend_data():
    """Pre-populates the last 2 hours of trend data for immediate visualization."""
    global trend_data
    
    if USE_MONGO:
        try:
            count = trend_collection.count_documents({})
            if count > 0:
                print(f"🍃 MongoDB already has {count} records. Skipping seed.")
                # Load latest 240 into memory for immediate cache
                cursor = trend_collection.find().sort("created_at", -1).limit(240)
                data = list(cursor)
                trend_data = data[::-1]
                return
        except Exception as e:
            print(f"⚠️ Mongo check failed during seed: {e}")

    print("⏳ Seeding trend history (2 hours)...")
    
    now = datetime.datetime.now()
    batch = []
    for i in range(120, 0, -1):
        past_time = now - datetime.timedelta(minutes=i)
        h = past_time.hour
        t_mult = time_multiplier(h, past_time.minute)
        zones_snap = {}
        total_act = 0
        total_pred = 0
                
        for zid, config in ZONES.items():
            # Apply zonal behavioral logic
            z_mult = zonal_multiplier(config.get("type"), t_mult, h)
            
            # Base simulated density with some noise
            target_density = int(config["base_density"] * z_mult * random.uniform(0.95, 1.05))
            pred = int(target_density * random.uniform(0.98, 1.02))
            actual = int(target_density * random.uniform(0.9, 1.1))
            zones_snap[zid] = {
                "actual": actual,
                "predicted": pred,
                "cri": calculate_cri(actual, config["capacity"], pred, 0, h)
            }
            total_act += actual
            total_pred += pred
            
        snapshot = {
            "timestamp": past_time.strftime("%H:%M:%S"),
            "hour": past_time.strftime("%H:%M"),
            "total_actual": total_act,
            "total_predicted": total_pred,
            "avg_cri": round(sum(z["cri"] for z in zones_snap.values()) / len(zones_snap), 1),
            "zones": zones_snap,
            "created_at": past_time
        }
        trend_data.append(snapshot)
        batch.append(snapshot)

    if USE_MONGO and batch:
        try:
            trend_collection.insert_many(batch)
        except Exception as e:
            print(f"⚠️ Failed to seed MongoDB: {e}")
            
    print(f"✅ Seeding complete. {len(trend_data)} records generated.")

def seed_admin_user():
    """Seeds a default admin user if none exists."""
    if USE_MONGO:
        try:
            if users_collection.count_documents({}) == 0:
                users_collection.insert_one({
                    "email": "admin@vnrvjiet.in",
                    "password": "admin"
                })
                print("👤 Default admin user seeded (admin@vnrvjiet.in / admin)")
        except Exception as e:
            print(f"⚠️ Failed to seed admin user: {e}")

if __name__ == '__main__':
    # Pre-seed users
    seed_admin_user()
    
    # Pre-seed history
    seed_trend_data()
    
    # Start simulator in background thread
    sim_thread = threading.Thread(target=simulator_loop, daemon=True)
    sim_thread.start()

    print("=" * 60)
    print("  CrowdSense Backend API")
    print("  http://127.0.0.1:5000")
    print("=" * 60)
    print("  Endpoints:")
    print("    GET /api/live           — All zones live data")
    print("    GET /api/alerts         — Active alerts")
    print("    GET /api/zone/<id>      — Single zone data")
    print("    GET /api/history/<id>   — Zone density history")
    print("    GET /api/summary        — Aggregated metrics")
    print("    GET /api/trend          — Time-series trend data")
    print("    GET /api/trend/<id>     — Zone-specific trend data")
    print("    GET /api/forecast       — Future state prediction")
    print("=" * 60)

    app.run(host='0.0.0.0', port=5000, debug=False)

