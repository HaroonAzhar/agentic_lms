import logging
# import os

from dotenv import load_dotenv
from google.adk.agents import LlmAgent
from google.adk.a2a.utils.agent_to_a2a import to_a2a
# from google.adk.tools.mcp_tool import MCPToolset, StreamableHTTPConnectionParams

logger = logging.getLogger(__name__)
logging.basicConfig(format="[%(levelname)s]: %(message)s", level=logging.INFO)

load_dotenv()

# logger.info("--- 🔧 Loading MCP tools from MCP Server... ---")
logger.info("--- 🤖 Creating ADK Grading Agent... ---")
from . import prompt

root_agent = LlmAgent(
    model="gemini-3.1-pro-preview",
    name="grading_agent",
    description="An agent that can help with grading responses from quizzes abd activities",
    instruction=prompt.GRADING_AGENT_PROMPT,
)

# Make the agent A2A-compatible
a2a_app = to_a2a(root_agent, port=10001)