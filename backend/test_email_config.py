
import os
import smtplib
from email.message import EmailMessage

# 1. Check Environment Variables
print("🔍 Checking Email Configuration...")
email_user = os.getenv("EMAIL_USER")
email_pass = os.getenv("EMAIL_PASS")
email_host = os.getenv("EMAIL_HOST", "smtp.gmail.com")
email_port = int(os.getenv("EMAIL_PORT", 587))

if not email_user or not email_pass:
    print("❌ Missing Credentials!")
    print("   Please set EMAIL_USER and EMAIL_PASS environment variables.")
    print("   Note: For Gmail, use an 'App Password', not your login password.")
    
    # Optional: Allow manual input for testing
    print("\n   --- Temporary Manual Input (for this test only) ---")
    email_user = input("   Enter Email (e.g. alerts@gmail.com): ").strip()
    email_pass = input("   Enter App Password: ").strip()

if not email_user or not email_pass:
    print("❌ No credentials provided. Exiting.")
    exit()

# 2. Try Sending Test Email
print(f"\n📨 Attempting to send test email via {email_host}:{email_port}...")
print(f"   From: {email_user}")
print(f"   To:   {email_user} (Sending to self)")

msg = EmailMessage()
msg.set_content("This is a test email from the CrowdSense Backend Automation Agent.\n\nIf you see this, your email configuration is correct! 🚀")
msg['Subject'] = "✅ CrowdSense SMTP Test"
msg['From'] = email_user
msg['To'] = email_user

try:
    with smtplib.SMTP(email_host, email_port) as server:
        server.starttls()
        server.login(email_user, email_pass)
        server.send_message(msg)
    
    print("\n✅ SUCCESS! Email sent successfully.")
    print("   Check your inbox for 'CrowdSense SMTP Test'.")
    print("   The Automation Agent should now work if these same credentials are set in the backend environment.")

except smtplib.SMTPAuthenticationError:
    print("\n❌ Authentication Failed!")
    print("   - Check your username and password.")
    print("   - For Gmail: Did you use an App Password? (Account > Security > 2-Step Verification > App Passwords)")
except Exception as e:
    print(f"\n❌ Connection Failed: {e}")
