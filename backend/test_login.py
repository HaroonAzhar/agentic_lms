import httpx

url = "http://localhost:8000/auth/token"
payload = {
    "username": "admin",
    "password": "password"
}
headers = {
    "Content-Type": "application/x-www-form-urlencoded"
}

try:
    response = httpx.post(url, data=payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
