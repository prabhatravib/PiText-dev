# src/llm.py
# --------------------------------------------------------------------------- #
# OpenAI-powered helpers for text answers and Mermaid diagrams
# --------------------------------------------------------------------------- #

import os
from pathlib import Path

from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()  # loads .env in project root (or wherever you keep the key)


# --------------------------------------------------------------------------- #
# Infrastructure
# --------------------------------------------------------------------------- #

def get_client() -> AsyncOpenAI:
    """Return an AsyncOpenAI client initialised from the OPENAI_API_KEY env var."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not set")
    return AsyncOpenAI(api_key=api_key)


def load_prompt(filename: str) -> str:
    """
    Read a prompt template from ./prompts/<filename> relative to this file.
    """
    prompt_path = Path(__file__).parent / "prompts" / filename
    return prompt_path.read_text(encoding="utf-8")


# --------------------------------------------------------------------------- #
# Core LLM calls
# --------------------------------------------------------------------------- #

async def generate_content(query: str) -> str:
    """
    Ask the LLM for a concise content description that can later be rendered
    into a diagram.
    """
    client = get_client()
    system_prompt = load_prompt("content.txt")

    response = await client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ],
        temperature=0.7,
        max_tokens=500,
    )
    return response.choices[0].message.content


async def select_diagram_type(query: str) -> str:
    """
    Decide whether the *query* is better answered with a flowchart or a
    radial mind-map.  Returns either `"flowchart"` or `"radial_mindmap"`.
    """
    client = get_client()

    selector_prompt = """You are a diagram-type selector.

Choose between:
- flowchart        : sequential steps, how-to, decision logic
- radial_mindmap   : concept overviews, definitions, characteristics

Respond with ONLY one word: "flowchart" or "radial_mindmap"."""

    response = await client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {"role": "system", "content": selector_prompt},
            {"role": "user", "content": query},
        ],
        temperature=0.3,
        max_tokens=5,
    )
    return response.choices[0].message.content.strip()


async def generate_diagram_with_type(
    content_description: str,
    original_query: str,
    diagram_type: str = "radial_mindmap",
) -> str:
    """
    Produce Mermaid markup for *content_description* using *diagram_type*
    ('flowchart' | 'radial_mindmap').
    """
    client = get_client()

    if diagram_type == "flowchart":
        system_prompt = load_prompt("diagram_flowchart.txt")
        user_message = (
            f"Create a Mermaid flowchart that answers this query:\n\n{original_query}"
            f"\n\nContent details:\n{content_description}"
        )
    else:  # radial_mindmap
        system_prompt = load_prompt("diagram.txt")
        user_message = (
            "Create a radial Mermaid mind-map from this content:\n"
            f"{content_description}"
        )

    response = await client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.7,
        max_tokens=1_500,
    )
    return response.choices[0].message.content


# --------------------------------------------------------------------------- #
# Convenience “all-in-one” helper
# --------------------------------------------------------------------------- #

async def generate_diagram(query: str) -> str:
    """
    1. Summarise *query* into a content description,
    2. Decide the best diagram type,
    3. Return Mermaid code.
    """
    content_description = await generate_content(query)
    diagram_type = await select_diagram_type(query)
    return await generate_diagram_with_type(
        content_description=content_description,
        original_query=query,
        diagram_type=diagram_type,
    )


# --------------------------------------------------------------------------- #
# Local smoke-test (runs only when you execute this file directly)
# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    import asyncio
    import sys

    async def _demo(q: str):
        print(await generate_diagram(q))

    asyncio.run(
        _demo(sys.argv[1] if len(sys.argv) > 1 else "Explain photosynthesis")
    )
