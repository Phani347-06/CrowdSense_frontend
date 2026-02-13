
import requests
import time

print("🕵️ Analyzing n8n Webhook Configuration...\n")

# Settings
BASE_URL = "http://localhost:5678"
PATH = "crowd-alert"
PAYLOAD = {
    "location": "Debug Test Zone",
    "issue": "Connection Diagnosis",
    "current": 50,
    "capacity": 20,
    "recipient_email": "debug@test.com",
    "level": "CRITICAL",
    "timestamp": "2026-02-14 10:00:00"
}

# 1. Test Production URL
prod_url = f"{BASE_URL}/webhook/{PATH}"
print(f"👉 Attempt 1: Production URL ({prod_url})")
try:
    res = requests.post(prod_url, json=PAYLOAD, timeout=2)
    print(f"   Response: {res.status_code}")
    if res.status_code == 200:
        print("   ✅ SUCCESS! Workflow is Active and receiving data.")
    elif res.status_code == 404:
        print("   ❌ FAILED (404): Workflow is NOT Active (Switch is OFF).")
    else:
        print(f"   ⚠️ Unexpected Status: {res.status_code}")
except Exception as e:
    print(f"   ❌ Connection Error: {e}")

print("\n" + "-"*30 + "\n")

# 2. Test Test URL
test_url = f"{BASE_URL}/webhook-test/{PATH}"
print(f"👉 Attempt 2: Test URL ({test_url})")
try:
    res = requests.post(test_url, json=PAYLOAD, timeout=2)
    print(f"   Response: {res.status_code}")
    if res.status_code == 200:
        print("   ✅ SUCCESS! Workflow is available in TEST mode.")
        print("   (Data should appear in your n8n canvas if you clicked 'Execute')")
    elif res.status_code == 404:
        print("   ❌ FAILED (404): 'webhook-test' not found. Is the path correct?")
        print("      Make sure the Webhook Node path is set to: 'crowd-alert'")
        print("      Make sure the Method is set to: 'POST'")
    else:
        print(f"   ⚠️ Unexpected Status: {res.status_code}")
except Exception as e:
    print(f"   ❌ Connection Error: {e}")

print("\n📋 DIAGNOSIS:")
print("1. If Attempt 1 failed (404): You must toggle the 'Active' switch to ON in n8n.")
print("2. If Attempt 2 succeeded: You can use Test mode, but you MUST click 'Execute Workflow' first.")
print("3. If Both failed: The Webhook Node configuration is wrong (Check Path & Method).")
