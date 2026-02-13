
from pymongo import MongoClient
import requests
import datetime

try:
    client = MongoClient('mongodb://localhost:27017/')
    db = client['crowdsense']
    regs = list(db.registrations.find())
    
    print(f"🔍 Found {len(regs)} total registrations:")
    for r in regs:
        print(f"   - {r.get('user_email', 'N/A')} | Zone: {r.get('zone_id')} | Status: {r.get('status')}")

    # Test trigger for 'lib' specifically
    print("\n🚀 Testing Manual Trigger for 'lib'...")
    lib_regs = list(db.registrations.find({"zone_id": "lib", "status": {"$in": ["APPROVED", "PENDING"]}}))
    print(f"   found {len(lib_regs)} subscribers for 'lib'")

    if len(lib_regs) > 0:
        for r in lib_regs:
            payload = {
                "location": "Main Library",
                "current": 45,
                "capacity": 20,
                "recipient_email": r.get("contact_email") or r.get("user_email"),
                "event": r.get("event_name"),
                "level": "CRITICAL",
                "issue": "DEBUG TEST: Manual Trigger Script",
                "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            try:
                print(f"   ➤ Sending webhook to n8n for {payload['recipient_email']}...")
                res = requests.post("http://localhost:5678/webhook/crowd-alert", json=payload, timeout=3)
                print(f"   ✅ n8n Response: {res.status_code} - {res.text}")
            except Exception as e:
                print(f"   ❌ n8n Connection Failed: {e}")
    else:
        print("   ⚠️ No subscribers found for 'lib'. Please register in the UI.")

except Exception as e:
    print(f"Error: {e}")
