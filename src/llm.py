# src/llm.py

import os
from pathlib import Path
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# Initialize client after loading env vars
def get_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return AsyncOpenAI(api_key=api_key)

def load_prompt(filename):
    prompt_path = Path(__file__).parent / "prompts" / filename
    return prompt_path.read_text()

async def generate_content(query):
    client = get_client()
    system_prompt = load_prompt("content.txt")
    
    response = await client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ],
        temperature=0.7,
        max_tokens=500
    )
    
    return response.choices[0].message.content

async def generate_diagram(content_description):
    client = get_client()
    system_prompt = load_prompt("diagram.txt")
    
    # Pass the content description directly to encourage radial structure
    user_message = f"Create a radial Mermaid diagram for this content:\n{content_description}"
    
    response = await client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        temperature=0.7,
        max_tokens=1500
    )
    
    return response.choices[0].message.content

async def select_diagram_type(query):
    """
    Let the LLM decide between flowchart or radial mindmap.
    """
    client = get_client()
    
    system_prompt = """You are a diagram type selector. Given a user query, determine the most appropriate diagram type.

Choose between:
- flowchart: For sequential processes, steps, algorithms, decisions, or "how to" questions
- radial_mindmap: For overviews, concepts, characteristics, definitions, or "what is" questions

Respond with ONLY one word: either "flowchart" or "radial_mindmap"."""
    
    response = await client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"What diagram type should I use for: {query}"}
        ],
        temperature=0.3,  # Low temperature for consistent selection
        max_tokens=20
    )
    
    return response.choices[0].message.content.strip()

async def generate_diagram_with_type(content_description, diagram_type, original_query):
    """
    Generate a diagram based on the selected type.
    """
    client = get_client()
    
    # Load the appropriate prompt
    if diagram_type == "flowchart":
        system_prompt = load_prompt("diagram_flowchart.txt")
        user_message = f"Create a flowchart for this query: {original_query}\n\nContent description: {content_description}"
    else:  # radial_mindmap
        system_prompt = load_prompt("diagram.txt")  # Your existing radial prompt
        user_message = f"Create a radial Mermaid diagram for this content:\n{content_description}"
    
    response = await client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        temperature=0.7,
        max_tokens=1500
    )
    
    return response.choices[0].message.content
