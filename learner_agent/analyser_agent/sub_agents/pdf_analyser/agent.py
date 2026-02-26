from google.adk.agents.llm_agent import Agent

from . import prompt

pdf_analyser_agent = Agent(
    model="gemini-3-pro-preview",
    name="pdf_analyser_agent",
    description="A helpful agent to analyse pdf.",
    instruction=prompt.PDF_ANALYSER_PROMPT,
)
