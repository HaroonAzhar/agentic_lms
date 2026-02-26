from google.adk.agents.llm_agent import Agent

from . import prompt

video_analyser_agent = Agent(
    model="gemini-3-pro-preview",
    name="video_analyser_agent",
    description="A helpful agent to analyse video.",
    instruction=prompt.VIDEO_ANALYSER_PROMPT,
)
