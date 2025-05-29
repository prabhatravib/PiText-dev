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
        model="gpt-4.1",
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
    
    response = await client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Create a Mermaid diagram for: {content_description}"}
        ],
        temperature=0.7,
        max_tokens=1500
    )
    
    return response.choices[0].message.content
