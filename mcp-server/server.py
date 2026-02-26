import asyncio
import logging
import os
import json
from fastmcp import FastMCP
from sqlmodel import create_engine, Session, select
from typing import List, Dict, Any

from models import * # From copied models.py

# Initialize Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# DB Connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://lms_user:lms_password@localhost:5435/lms_db")
engine = create_engine(DATABASE_URL)

mcp = FastMCP("Knowledge MCP Server 💵")

def get_session():
    with Session(engine) as session:
        yield session

@mcp.tool()
def get_resource_content(resource_id: int) -> str:
    """
    Retrieves the content of a resource (text) from the database to be analyzed.
    Args:
        resource_id: The ID of the resource to fetch.
    Returns:
        The content string or error message.
    """
    logger.info(f"Fetching content for resource {resource_id}")
    with Session(engine) as session:
        resource = session.get(Resource, resource_id)
        if not resource:
            return f"Error: Resource with ID {resource_id} not found."
        
        # If content is empty, maybe fetch from URL? 
        # For now, assume content is populated or URL is useful.
        # If content is empty, return URL so agent knows.
        if not resource.content:
            return f"URL: {resource.url} (Content not extracted yet)"
        return resource.content

@mcp.tool()
def save_study_lab(resource_id: int, topics: List[Dict[str, Any]], key_concepts: List[Dict[str, Any]], occurrences: List[Dict[str, Any]]) -> str:
    """
    Saves the analysis results (Topics, Key Concepts, Occurrences) to the database.
    Args:
        resource_id: ID of the resource analyzed.
        topics: List of topics found (id, name, outline).
        key_concepts: List of key concepts (id, name, description, occurrence_id, etc).
        occurrences: List of occurrences (id, topic_id, resource_id).
    Returns:
        Success message.
    """
    logger.info(f"Saving study lab for resource {resource_id}")
    try:
        with Session(engine) as session:
            # 1. Save Topics
            for t_data in topics:
                # Check if topic exists? Or upsert?
                # Using merge for upsert behavior if ID is provided
                topic = Topic(**t_data)
                session.merge(topic)
            
            # 2. Save Occurrences
            for o_data in occurrences:
                occurrence = Occurrence(**o_data)
                session.merge(occurrence)
                
            # 3. Save Key Concepts
            for k_data in key_concepts:
                concept = KeyConcept(**k_data)
                session.merge(concept)
            
            session.commit()
            return "Successfully saved Study Lab data."
            
    except Exception as e:
        logger.error(f"Failed to save data: {e}")
        return f"Error saving data: {str(e)}"

if __name__ == "__main__":
    import uvicorn
    # Cloud Run expects PORT env var
    port = int(os.getenv("PORT", 8080))
    logger.info(f"🚀 MCP server starting on port {port}")
    # Run simple uvicorn for FastMCP (it has .run() but explicitly controlling it is fine)
    mcp.run(transport="sse", port=port, host="0.0.0.0")
