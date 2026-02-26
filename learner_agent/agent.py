import logging
# import os

from dotenv import load_dotenv
from google.adk.agents import LlmAgent
from google.adk.a2a.utils.agent_to_a2a import to_a2a
# from google.adk.tools.mcp_tool import MCPToolset, StreamableHTTPConnectionParams

logger = logging.getLogger(__name__)
logging.basicConfig(format="[%(levelname)s]: %(message)s", level=logging.INFO)

load_dotenv()

logger.info("--- 🔧 Loading MCP tools from MCP Server... ---")
logger.info("--- 🤖 Creating ADK Le arner Agent... ---")
from . import prompt
from .analyser_agent.agent import analyser_agent
from .evaluator_agent.agent import evaluator_agent

root_agent = LlmAgent(
    model="gemini-3-pro-preview",
    name="learner_agent",
    description="An agent that can help with learning from resources",
    instruction=prompt.ROOT_PROMPT,
    sub_agents=[
        analyser_agent,
        evaluator_agent,
    ],
)

# Make the agent A2A-compatible
a2a_app = to_a2a(root_agent, port=10000)
