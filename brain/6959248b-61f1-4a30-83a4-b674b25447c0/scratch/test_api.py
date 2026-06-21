import os
import sys

# Add artifacts/api-server-py to path
sys.path.insert(0, r"c:\Users\epicaryan\Downloads\projects\PR-Reviewer\artifacts\api-server-py")

# Load env variables manually
def load_env_file():
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    for _ in range(4):
        env_path = os.path.join(curr_dir, ".env")
        if os.path.exists(env_path):
            print(f"Loading .env from {env_path}")
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, val = line.split("=", 1)
                        os.environ[key.strip()] = val.strip()
            break
        curr_dir = os.path.dirname(curr_dir)

load_env_file()

from fastapi.testclient import TestClient
from main import app, init_db

init_db()
client = TestClient(app)

print("\n--- Registering & Login ---")
client.post("/api/auth/register", json={"username": "test_operator", "password": "testpassword"})
res = client.post("/api/auth/token", data={"username": "test_operator", "password": "testpassword"})
token = res.json().get("access_token")
headers = {"Authorization": f"Bearer {token}"}

print("\n--- Testing Ticket-only Brief ---")
try:
    payload = {
        "jiraUrl": "PROJ-123",
        "jiraContext": "Implement authentication using JWT tokens and add secure routes."
    }
    res = client.post("/api/briefs", json=payload, headers=headers)
    print("Status code:", res.status_code)
    print("Response JSON:", res.json())
except Exception as e:
    print("Error:", e)
