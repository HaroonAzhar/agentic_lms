import asyncio
import os
import sys
import logging

logging.basicConfig(level=logging.INFO)

# Add backend to path so imports work
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.services.agent_service import trigger_resource_analysis

async def test():
    print("Triggering analysis...")
    try:
        url = "https://storage.googleapis.com/lms_ds_p1/classes/1/resources/chem-5.mp4"
        result = await trigger_resource_analysis(999, url)
        print("Result:", result)
    except Exception as e:
        print("ERROR:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
