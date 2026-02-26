import httpx
import sys

BASE_URL = "http://localhost:8000"
USERNAME = "admin" 
PASSWORD = "password"

def login():
    try:
        resp = httpx.post(f"{BASE_URL}/auth/token", data={"username": USERNAME, "password": PASSWORD})
        resp.raise_for_status()
        return resp.json()["access_token"]
    except Exception as e:
        print(f"Login failed: {e}")
        try:
             resp = httpx.post(f"{BASE_URL}/auth/token", data={"username": "teacher1", "password": "password"})
             resp.raise_for_status()
             return resp.json()["access_token"]
        except:
            print("Login with teacher1 also failed.")
            sys.exit(1)

def get_analysis(token):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        # 1. Get Classes
        resp = httpx.get(f"{BASE_URL}/teacher/classes", headers=headers)
        if resp.status_code != 200:
             print(f"Failed to list classes: {resp.text}")
             return
        
        classes = resp.json()
        if not classes:
            print("No classes found for this teacher.")
            return

        print(f"Found {len(classes)} classes. Checking resources...")
        
        all_resources = []
        for cls in classes:
            resp = httpx.get(f"{BASE_URL}/teacher/classes/{cls['id']}/resources", headers=headers)
            if resp.status_code == 200:
                all_resources.extend(resp.json())
        
        if not all_resources:
            print("No resources found in any class.")
            return

        # Get latest resource
        latest_resource = sorted(all_resources, key=lambda x: x['id'], reverse=True)[0]
        print(f"Checking analysis for latest resource ID: {latest_resource['id']} ({latest_resource['title']})")

        resp = httpx.get(f"{BASE_URL}/teacher/resources/{latest_resource['id']}/analysis", headers=headers)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            import json
            print(json.dumps(resp.json(), indent=2))
        else:
            print(resp.text)
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    token = login()
    get_analysis(token)
