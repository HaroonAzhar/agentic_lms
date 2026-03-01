import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(
    vertexai=True,
    project=os.getenv("GOOGLE_CLOUD_PROJECT"),
    location=os.getenv("GOOGLE_CLOUD_LOCATION")
)

print("Available models:")
for model in client.models.list():
    if ("gemini" in model.name and "vision" not in model.name):
        print(model.name)
