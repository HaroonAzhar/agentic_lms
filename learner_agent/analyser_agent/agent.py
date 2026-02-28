from google.adk.agents.llm_agent import Agent

from . import prompt
from .sub_agents.pdf_analyser.agent import pdf_analyser_agent
from .sub_agents.video_analyser.agent import video_analyser_agent

analyser_agent = Agent(
    model="gemini-3.1-pro-preview",
    name="analyser_agent",
    description="A helpful agent to analyse resource.",
    instruction=prompt.ANALYSER_AGENT_PROMPT,
    sub_agents=[
        pdf_analyser_agent,
        video_analyser_agent,
    ],
)
