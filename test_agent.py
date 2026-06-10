#!/usr/bin/env python3
import requests
import json
import os

# Load env variables
from dotenv import load_dotenv
load_dotenv('/Users/angelofato/Documents/turno-app copia/.env')
load_dotenv('/Users/angelofato/Documents/turno-app copia/.env.local')

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
print(f"Testing agent-ask function at: {SUPABASE_URL}/functions/v1/agent-ask")

# Test data
test_payload = {
    "query": "Qual è lo stato della produzione oggi?",
    "context": {
        "globalDate": "2026-06-09",
        "turnoCorrente": "D"
    }
}

try:
    response = requests.post(
        f"{SUPABASE_URL}/functions/v1/agent-ask",
        json=test_payload,
        timeout=30
    )
    
    print(f"\n✅ Status Code: {response.status_code}")
    print(f"Response:\n{json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
except Exception as e:
    print(f"❌ Error: {e}")
