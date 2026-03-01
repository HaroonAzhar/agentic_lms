import httpx
import logging
import json
import re
from sqlmodel import Session, select
from ..database import engine
from ..models import Topic, KeyConcept, Occurrence, Resource

logger = logging.getLogger(__name__)

AGENT_URL = "http://localhost:10000" # URL of the A2A agent service
GRADING_AGENT_URL = "http://localhost:10001" # URL of the Grading A2A agent

async def grade_assignment_submission(assignment_id: int, student_id: int, questions_with_answers: list, topics: list) -> dict:
    """
    Triggers the Grading Agent to evaluate a student's submission.
    questions_with_answers looks like: [{"question_id": 1, "question": "What is...", "answer": "It is..."}, ...]
    topics looks like: [{"id": 1, "name": "Topic A"}, ...]
    """
    logger.info(f"Triggering grading for assignment {assignment_id} by student {student_id}")
    try:
        import uuid
        message_id = uuid.uuid4().hex
        
        submission_data = []
        for i, qa in enumerate(questions_with_answers, 1):
            submission_data.append({
                f"question{i}": qa["question"],
                f"answer{i}": qa["answer"],
                "question_id": qa["question_id"]
            })
            
        prompt_text = f"Please grade the following assignment submission based on the provided grading guide.\n\n"
        prompt_text += f"<Submission>\n{json.dumps(submission_data, indent=4)}\n</Submission>\n\n"
        prompt_text += f"<Topics>\n{json.dumps(topics, indent=4)}\n</Topics>"
            
        payload = {
            "jsonrpc": "2.0",
            "method": "message/send", 
            "params": {
                "message": {
                    "role": "user",
                    "parts": [{"kind": "text", "text": prompt_text}],
                    "messageId": message_id,
                    "contextId": f"grade_{assignment_id}_{student_id}"
                },
                "configuration": {} 
            },
            "id": f"grading_{assignment_id}_{student_id}"
        }
        
        async with httpx.AsyncClient() as client:
             resp = await client.post(f"{GRADING_AGENT_URL}/", json=payload, timeout=60.0)
             resp.raise_for_status()
             
             response_data = resp.json()
             agent_result = response_data.get("result")
             parsed_data = None
             
             if isinstance(agent_result, dict):
                 if "result" in agent_result and isinstance(agent_result["result"], dict):
                     agent_result = agent_result["result"]

                 if "history" in agent_result and isinstance(agent_result["history"], list) and len(agent_result["history"]) > 0:
                     last_msg = agent_result["history"][-1]
                     if "parts" in last_msg and len(last_msg["parts"]) > 0:
                         for part in last_msg["parts"]:
                             if part.get("kind") == "text":
                                 parsed_data = parse_agent_response(part["text"])
                                 if parsed_data: break
                 
                 if not parsed_data and "parts" in agent_result:
                      for part in agent_result["parts"]:
                          if part.get("kind") == "text":
                              parsed_data = parse_agent_response(part["text"])
                              if parsed_data: break

                 if not parsed_data and "response" in agent_result:
                      parsed_data = parse_agent_response(agent_result["response"])
             
             elif isinstance(agent_result, str):
                 parsed_data = parse_agent_response(agent_result)
             
             if parsed_data:
                 return parsed_data
             else:
                 logger.error(f"No valid data parsed from grading agent result: {agent_result}")
                 return None
              
    except Exception as e:
        logger.error(f"Failed to trigger grading agent: {e}")
        return None

def parse_agent_response(response_text: str):
    """
    Extracts JSON from the agent's response, handling Markdown code blocks.
    """
    try:
        # Try to find JSON block
        json_match = re.search(r"```json\s*(.*?)\s*```", response_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(1)
        else:
            # Maybe the whole response is JSON
            json_str = response_text
        
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode JSON: {e}")
        return None

async def trigger_resource_analysis(resource_id: int, url: str):
    """
    Triggers the Learner Agent to analyze a resource.
    This sends a message to the agent acting as the 'User'.
    """
    logger.info(f"Triggering analysis for resource {resource_id} at {url}")
    try:
        # Construct JSON-RPC 2.0 Request
        # Based on error, method is required. Common methods: 'generate', 'chat', 'predict'.
        # Assuming 'generate' or a similar method exposed by LlmAgent via to_a2a.
        # Construct payload matching test_client.py
        import uuid
        message_id = uuid.uuid4().hex
        
        # Check if URL is a GCS public URL
        parts = []
        if url and url.startswith("https://storage.googleapis.com/"):
            gs_uri = url.replace("https://storage.googleapis.com/", "gs://")
            
            # Determine mime type roughly from url extension
            mime_type = "video/mp4" # Default fallback
            if url.lower().endswith(".pdf"):
                mime_type = "application/pdf"
            
            # Check if using Vertex AI or AI Studio
            import os
            if os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "FALSE").upper() != "TRUE":
                from google import genai
                import httpx
                import tempfile
                import time

                try:
                    # Explicitly load root .env to get the API key if not in env
                    from dotenv import load_dotenv
                    root_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), '.env')
                    load_dotenv(root_env_path)
                    
                    api_key = os.getenv("GOOGLE_API_KEY")
                    client = genai.Client(api_key=api_key)
                    
                    # 1. Download to local temp file
                    ext = ".pdf" if mime_type == "application/pdf" else ".mp4"
                    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                        tmp_path = tmp.name
                    
                    logger.info(f"Downloading {url} to {tmp_path} for AI Studio upload")
                    async with httpx.AsyncClient(timeout=600.0) as http_client:
                        async with http_client.stream("GET", url) as response:
                            response.raise_for_status()
                            with open(tmp_path, "wb") as f:
                                async for chunk in response.aiter_bytes():
                                    f.write(chunk)
                    
                    # 2. Upload to AI Studio
                    logger.info(f"Uploading local file {tmp_path} to AI Studio GenAI File Storage")
                    genai_file = client.files.upload(file=tmp_path, config={'mime_type': mime_type})
                    
                    # 3. Wait for processing if video
                    while genai_file.state.name == "PROCESSING":
                        logger.info(f"Waiting for AI Studio video processing... {genai_file.name}")
                        time.sleep(5)
                        genai_file = client.files.get(name=genai_file.name)
                        
                    if genai_file.state.name == "FAILED":
                        raise ValueError(f"AI Studio File processing failed for {genai_file.name}")
                        
                    logger.info(f"Uploaded to AI Studio successfully: {genai_file.uri}")
                    gs_uri = genai_file.uri
                except Exception as e:
                    logger.error(f"Failed to upload to AI Studio: {e}")
                    raise
                finally:
                    if 'tmp_path' in locals() and os.path.exists(tmp_path):
                        os.remove(tmp_path)
            
            parts.append({
                "kind": "file",
                "file": {
                    "mime_type": mime_type,
                    "uri": gs_uri
                }
            })
        
        # Always append the text instruction
        parts.append({
            "kind": "text", 
            "text": "Analyze this resource thoroughly." if parts else f"Analyze this resource: {url}"
        })
        
        payload = {
            "jsonrpc": "2.0",
            "method": "message/send", 
            "params": {
                "message": {
                    "role": "user",
                    "parts": parts,
                    "messageId": message_id,
                    "contextId": f"ctx_{resource_id}"
                },
                "configuration": {} 
            },
            "id": f"resource_{resource_id}"
        }
        
        async with httpx.AsyncClient() as client:
             # Increase timeout for complex video analysis
             resp = await client.post(f"{AGENT_URL}/", json=payload, timeout=12000.0)
             resp.raise_for_status()
             
             response_data = resp.json()
             logger.info(f"Agent response: {response_data}")
             
             # DEBUG: Write to file
             with open("agent_debug.log", "a") as f:
                 f.write(f"\n{'='*50}\nResource {resource_id} Response:\n{json.dumps(response_data, indent=2)}\n{'='*50}\n")
             
             logger.info(f"\n{'-'*30}\nAGENT RESPONSE:\n{json.dumps(response_data, indent=2)}\n{'-'*30}")
             
             # Extract result
             agent_result = response_data.get("result")
             logger.info(f"Result type: {type(agent_result)}")
             
             parsed_data = None
             
             if isinstance(agent_result, dict):
                 # Check for 'result' wrapper inside result if double-wrapped
                 if "result" in agent_result and isinstance(agent_result["result"], dict):
                     agent_result = agent_result["result"]

                 # Strategy 1: Look for 'history' (Task object)
                 if "history" in agent_result and isinstance(agent_result["history"], list) and len(agent_result["history"]) > 0:
                     last_msg = agent_result["history"][-1]
                     if "parts" in last_msg and len(last_msg["parts"]) > 0:
                         for part in last_msg["parts"]:
                             if part.get("kind") == "text":
                                 parsed_data = parse_agent_response(part["text"])
                                 if parsed_data: break
                 
                 # Strategy 2: Look for direct 'message' (Message object)
                 if not parsed_data and "parts" in agent_result:
                      for part in agent_result["parts"]:
                          if part.get("kind") == "text":
                              parsed_data = parse_agent_response(part["text"])
                              if parsed_data: break

                 # Strategy 3: Fallback 'response' field
                 if not parsed_data and "response" in agent_result:
                      parsed_data = parse_agent_response(agent_result["response"])
             
             elif isinstance(agent_result, str):
                 parsed_data = parse_agent_response(agent_result)
             
             if parsed_data:
                 save_analysis_results(resource_id, parsed_data)
             else:
                 logger.error(f"No valid data parsed from agent result: {agent_result}")
              
    except Exception as e:
        logger.error(f"Failed to trigger agent: {e}")



def save_analysis_results(resource_id: int, data: dict):
    """
    Saves analysis results. Handles flattened structure from Agent prompt:
    {
        "topics": [{"id":..., "name":...}],
        "key_concepts": [{"id":..., "occurrence_id":...}],
        "occurrences": [{"id":..., "topic_id":...}]
    }
    """
    logger.info(f"Saving analysis results for resource {resource_id}")
    try:
        with Session(engine) as session:
            # Maps to store temporary ID to DB Object
            topic_map = {} # client_id -> db_obj
            occurrence_map = {} # client_id -> db_obj

            # 1. Save Topics
            for t in data.get("topics", []):
                t_name = t.get("name")
                if not t_name: continue
                
                topic = Topic(name=t_name, outline=t.get("outline"))
                session.add(topic)
                session.commit()
                session.refresh(topic)
                
                # Store mapping if client provided ID
                if t.get("id"):
                    topic_map[t["id"]] = topic
            
            # 2. Save Occurrences
            for occ in data.get("occurrences", []):
                client_topic_id = occ.get("topic_id")
                # Resolve topic_id (requires mapping from step 1)
                db_topic = topic_map.get(client_topic_id)
                
                if not db_topic:
                    # Fallback: if no ID map, maybe try matching by name? 
                    # Or if structure is actually nested? 
                    # Assuming flattened based on prompt. 
                    # If this fails, we lose data.
                    logger.warning(f"Could not find topic for occurrence {occ}")
                    continue

                occurrence = Occurrence(
                    topic_id=db_topic.id,
                    resource_id=resource_id
                )
                session.add(occurrence)
                session.commit()
                session.refresh(occurrence)
                
                if occ.get("id"):
                    occurrence_map[occ["id"]] = occurrence

            # 3. Save Key Concepts
            for kc in data.get("key_concepts", []):
                 client_occ_id = kc.get("occurrence_id") or kc.get("occurence_id") # handle typo in prompt
                 db_occ = occurrence_map.get(client_occ_id)
                 
                 if not db_occ:
                     logger.warning(f"Could not find occurrence for concept {kc}")
                     continue

                 key_concept = KeyConcept(
                     name=kc.get("name"),
                     description=kc.get("description"),
                     occurrence_id=db_occ.id,
                     timestamp_start=parse_timestamp(kc.get("timestamp_start")),
                     timestamp_end=parse_timestamp(kc.get("timestamp_end"))
                 )
                 session.add(key_concept)
            
            session.commit()
            logger.info("Analysis results saved successfully (Flattened Mode).")

    except Exception as e:
        logger.error(f"Failed to save analysis results: {e}")

def parse_timestamp(ts):
    """
    Parses timestamp from various formats (int, string int, "MM:SS") to seconds (int).
    """
    if ts is None:
        return 0
    
    try:
        if isinstance(ts, int) or isinstance(ts, float):
            return int(ts)
            
        if isinstance(ts, str):
            ts = ts.strip()
            if ":" in ts:
                parts = ts.split(":")
                # Handle HH:MM:SS or MM:SS
                if len(parts) == 3:
                     return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                elif len(parts) == 2:
                     return int(parts[0]) * 60 + int(parts[1])
            else:
                # Try parsing as simple number string
                return int(float(ts))
                
        return 0
    except Exception as e:
        logger.warning(f"Failed to parse timestamp {ts}: {e}")
        return 0
