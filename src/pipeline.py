# Updated src/pipeline.py

import logging
import os
import re

from src.llm import generate_content, select_diagram_type, generate_diagram_with_type
from src.renderer import render_mermaid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# Sanitizer remains the same
def sanitize_mermaid(snippet: str) -> str:
    text = snippet.strip()
    
    # Decode HTML entities
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')

    # 1) Remove Markdown fences/backticks
    text = re.sub(r'^```(?:mermaid)?\s*', '', text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r'```$', '', text, flags=re.MULTILINE)

    # 2) Normalize all dashes to plain hyphens
    text = text.replace('–', '-').replace('—', '-')

    lines = []
    for line in text.splitlines():
        stripped = line.strip()

        # 3) Rewrite any `subgraph X Y Z` into a safe id + quoted title
        if stripped.lower().startswith("subgraph"):
            title = stripped[len("subgraph"):].strip()
            safe_id = re.sub(r'[^0-9A-Za-z_]', '_', title)
            lines.append(f'subgraph {safe_id}["{title}"]')
            continue

        # 4) Quote unquoted labels in NodeID[Label] but preserve special node types
        if '((' in line and '))' in line:
            lines.append(line)
            continue
        
        if '("' in line and '")' in line:
            lines.append(line)
            continue

        def _quote_label(m):
            node, label = m.group(1), m.group(2).strip()
            if label.startswith('"') and label.endswith('"'):
                return f'{node}[{label}]'
            return f'{node}["{label}"]'

        line = re.sub(r'(\b[^\s\[\]]+)\[([^\]]+)\]', _quote_label, line)

        lines.append(line)

    return "\n".join(lines)

# Updated main pipeline
async def process_pipeline(query: str) -> dict:
    """
    1) Let LLM select between flowchart or radial mindmap
    2) Generate a text description
    3) Generate the appropriate diagram
    4) Sanitize and render
    """
    logging.info("Stage 1: Selecting diagram type...")
    diagram_type = await select_diagram_type(query)
    logging.info("Diagram type selected: %s", diagram_type)

    logging.info("Stage 2: Generating content...")
    content_description = await generate_content(query)
    logging.info("Content generated: %s", content_description)

    logging.info("Stage 3: Generating Mermaid snippet...")
    # Pass both content description and original query
    raw_snippet = await generate_diagram_with_type(content_description, query, diagram_type)
    logging.info("🚀 Raw LLM output:\n%s", raw_snippet)

    # SANITIZE
    mermaid_snippet = sanitize_mermaid(raw_snippet)
    logging.info("✔️  Sanitized Mermaid snippet:\n%s", mermaid_snippet)

    logging.info("Stage 4: Rendering snippet...")
    render_result = await render_mermaid(mermaid_snippet)

    return {
        "description": content_description,
        "diagram_type": diagram_type,
        "diagram": mermaid_snippet,
        **render_result
    }
