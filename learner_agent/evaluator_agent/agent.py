from google.adk.agents.llm_agent import Agent

from . import prompt

evaluator_agent = Agent(
    model="gemini-3-pro-preview",
    name="evaluator_agent",
    description="A helpful agent to evaluate the content.",
    instruction=prompt.EVALUATOR_AGENT_PROMPT,
)
