import logging
import os
import re

from src.llm import generate_content, generate_diagram
from src.renderer import render_mermaid

# ─── Configure logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# ─── Sanitizer: fences, dashes, labels, subgraphs ──────────────────────────────
def sanitize_mermaid(snippet: str) -> str:
    text = snippet.strip()

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
            # get everything after the word "subgraph"
            title = stripped[len("subgraph"):].strip()
            # generate a safe ID by replacing non-alphanumerics with underscore
            safe_id = re.sub(r'[^0-9A-Za-z_]', '_', title)
            lines.append(f'subgraph {safe_id}["{title}"]')
            continue

        # 4) Quote unquoted labels in NodeID[Label]
        def _quote_label(m):
            node, label = m.group(1), m.group(2).strip()
            if label.startswith('"') and label.endswith('"'):
                return f'{node}[{label}]'
            return f'{node}["{label}"]'

        line = re.sub(r'(\b[^\s\[\]]+)\[([^\]]+)\]', _quote_label, line)

        lines.append(line)

    return "\n".join(lines)

# ─── Main pipeline ────────────────────────────────────────────────────────────
async def process_pipeline(query: str) -> dict:
    """
    1) Generate a text description from the LLM
    2) Generate a raw Mermaid snippet via the LLM
    3) Sanitize (strip fences, normalize dashes, quote labels, fix subgraphs)
    4) Render the clean snippet into HTML or an image
    """
    logging.info("Stage 1: Generating content...")
    content_description = await generate_content(query)
    logging.info("Content generated: %s", content_description)

    logging.info("Stage 2: Generating Mermaid snippet...")
    raw_snippet = await generate_diagram(content_description)
    logging.info("🚀 Raw LLM output:\n%s", raw_snippet)

    # ─── SANITIZE ───────────────────────────────────────────────────────────────
    mermaid_snippet = sanitize_mermaid(raw_snippet)
    logging.info("✔️  Sanitized Mermaid snippet:\n%s", mermaid_snippet)

    logging.info("Stage 3: Rendering snippet...")
    render_result = await render_mermaid(mermaid_snippet)

    return {
        "description": content_description,
        "diagram": mermaid_snippet,
        **render_result
    }
