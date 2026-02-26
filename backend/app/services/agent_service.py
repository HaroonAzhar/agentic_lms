import httpx
import logging
import json
import re
from sqlmodel import Session, select
from ..database import engine
from ..models import Topic, KeyConcept, Occurrence, Resource

logger = logging.getLogger(__name__)

AGENT_URL = "http://localhost:10000" # URL of the A2A agent service

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
        
        payload = {
            "jsonrpc": "2.0",
            "method": "message/send", 
            "params": {
                "message": {
                    "role": "user",
                    "parts": [{"kind": "text", "text": f"Analyze this resource: {url}"}],
                    "messageId": message_id,
                    "contextId": f"ctx_{resource_id}"
                },
                "configuration": {} 
            },
            "id": f"resource_{resource_id}"
        }
        
        async with httpx.AsyncClient() as client:
             # Increase timeout for analysis
             resp = await client.post(f"{AGENT_URL}/", json=payload, timeout=60.0)
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
