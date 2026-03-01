import os
import asyncio
import httpx
import tempfile
import time
from dotenv import load_dotenv

load_dotenv()
url = "https://storage.googleapis.com/lms_ds_p1/classes/1/resources/chem-5.mp4"
mime_type = "video/mp4"

async def test_upload():
    print("Testing AI Studio upload logic...")
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "FALSE"
    from google import genai
    from dotenv import load_dotenv
    # explicitly load the root env
    root_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    load_dotenv(root_env_path)
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
    
    ext = ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp_path = tmp.name
    
    try:
        print(f"Downloading {url} to {tmp_path}")
        async with httpx.AsyncClient(timeout=600.0) as http_client:
            async with http_client.stream("GET", url) as response:
                response.raise_for_status()
                with open(tmp_path, "wb") as f:
                    async for chunk in response.aiter_bytes():
                        f.write(chunk)
        
        print(f"Uploading local file {tmp_path} to AI Studio GenAI File Storage")
        genai_file = client.files.upload(file=tmp_path, config={'mime_type': mime_type})
        
        while genai_file.state.name == "PROCESSING":
            print(f"Waiting for AI Studio video processing... {genai_file.name}")
            time.sleep(5)
            genai_file = client.files.get(name=genai_file.name)
            
        if genai_file.state.name == "FAILED":
            raise ValueError(f"AI Studio File processing failed for {genai_file.name}")
            
        print(f"Uploaded to AI Studio successfully: {genai_file.uri}")
    except Exception as e:
        print(f"ERROR OCCURRED: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    asyncio.run(test_upload())
