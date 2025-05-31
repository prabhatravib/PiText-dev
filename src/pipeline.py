# Updated src/pipeline.py

import logging
import os
import re
import html

from src.llm import generate_content, select_diagram_type, generate_diagram_with_type
from src.renderer import render_mermaid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# Fixed sanitizer
def sanitize_mermaid(snippet: str) -> str:
    text = snippet.strip()
    
    # Decode ALL HTML entities using html.unescape
    text = html.unescape(text)

    # 1) Remove Markdown fences/backticks
    text = re.sub(r'^```(?:mermaid)?\s*', '', text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r'```$', '', text, flags=re.MULTILINE)

    # 2) Normalize all dashes to plain hyphens
    text = text.replace('–', '-').replace('—', '-')
    
    # 3) Fix <br/> to <br> (Mermaid prefers without slash)
    text = text.replace('<br/>', '<br>')

    lines = []
    for line in text.splitlines():
        stripped = line.strip()

        # 4) Rewrite any `subgraph X Y Z` into a safe id + quoted title
        if stripped.lower().startswith("subgraph"):
            title = stripped[len("subgraph"):].strip()
            safe_id = re.sub(r'[^0-9A-Za-z_]', '_', title)
            lines.append(f'subgraph {safe_id}["{title}"]')
            continue

        # 5) Fix nodes with parentheses syntax - extract and clean the content
        paren_match = re.match(r'(\w+)\("([^"]+)"\)(.*)$', stripped)
        if paren_match:
            node_id = paren_match.group(1)
            content = paren_match.group(2)
            rest = paren_match.group(3)
            # Replace inner quotes with single quotes
            content = content.replace('"', "'")
            lines.append(f'{node_id}["{content}"]{rest}')
            continue

        # 6) Fix square bracket nodes - handle nested quotes
        bracket_match = re.match(r'(\w+)\["([^"]+)"\](.*)$', stripped)
        if bracket_match:
            node_id = bracket_match.group(1)
            content = bracket_match.group(2)
            rest = bracket_match.group(3)
            # Replace inner quotes with single quotes
            content = content.replace('"', "'")
            lines.append(f'{node_id}["{content}"]{rest}')
            continue
            
        # 7) Handle special node types (keep unchanged)
        if '((' in line and '))' in line:
            # For circular nodes, also fix any quotes in the content
            def fix_circular_quotes(m):
                content = m.group(1).replace('"', "'")
                return f'(({content}))'
            line = re.sub(r'\(\(([^)]+)\)\)', fix_circular_quotes, line)
            lines.append(line)
            continue

        # 8) General quote fixing for any remaining cases
        def _quote_label(m):
            node, label = m.group(1), m.group(2).strip()
            # Clean up the label - remove outer quotes if present
            if label.startswith('"') and label.endswith('"'):
                label = label[1:-1]
            # Replace any inner quotes with single quotes
            label = label.replace('"', "'")
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