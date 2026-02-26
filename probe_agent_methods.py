import httpx
import asyncio

AGENT_URL = "http://localhost:10000"

async def probe_method(method_name):
    payload = {
        "jsonrpc": "2.0",
        "method": method_name,
        "params": {
            "input": "Hello",
            "config": {}
        },
        "id": f"probe_{method_name}"
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{AGENT_URL}/", json=payload, timeout=5.0)
            data = resp.json()
            if "error" in data:
                print(f"Method '{method_name}' failed: {data['error']['message']}")
            else:
                print(f"✅ Method '{method_name}' SUCCESS!")
                print(data)
    except Exception as e:
        print(f"Method '{method_name}' network error: {e}")

async def main():
    methods = ["run", "generate", "predict", "invoke", "chat", "process"]
    print("Probing Agent JSON-RPC Methods...")
    for m in methods:
        await probe_method(m)

if __name__ == "__main__":
    asyncio.run(main())
