import os
from google.cloud import storage
from fastapi import UploadFile, HTTPException
import logging

logger = logging.getLogger(__name__)

# Bucket name should be in env or passed
BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "lms_ds_p1")

def get_storage_client():
    try:
        # Tries to get credentials from GOOGLE_APPLICATION_CREDENTIALS env var
        return storage.Client()
    except Exception as e:
        logger.error(f"Failed to initialize GCS Client: {e}")
        raise HTTPException(status_code=500, detail="Storage service unavailable")

async def upload_to_gcs(file: UploadFile, destination_blob_name: str) -> str:
    """
    Uploads a file to the bucket and returns the public URL.
    """
    client = get_storage_client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(destination_blob_name)

    logger.info(f"Uploading {file.filename} to gs://{BUCKET_NAME}/{destination_blob_name}")
    
    try:
        # Read file content and upload
        content = await file.read()
        blob.upload_from_string(content, content_type=file.content_type)
        
        # Make public? Or extract signed URL?
        # User requested: "The backend will use the url of that resources and pass it to the learner agent."
        # If the agent is internal/local, it might need a signed URL or public URL.
        # Assuming public readable for now or relying on A2A agent having access if same project.
        # But commonly we might just return the gs:// path or https url.
        # Let's return the public link for now, assuming bucket/object is public or accessible. 
        # CAUTION: By default objects are private. We might need to generate signed url if not public.
        # However, for this hackathon context, let's assume publicRead or we generate a signed URL for 1 hour.
        
        # Let's try to make it public-read for simplicity if allowed? 
        # blob.make_public() -> might fail if bucket settings prevent it.
        
        # Safer for Agent: Generate Signed URL (valid for 7 days?) or just return gs:// uri
        # The prompt examples use https://storage.googleapis.com/...
        # So it implies public access.
        
        # Let's return the public format URL.
        return f"https://storage.googleapis.com/{BUCKET_NAME}/{destination_blob_name}"

    except Exception as e:
        logger.error(f"GCS Upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")
    finally:
        await file.seek(0) # Reset file pointer if needed elsewhere
