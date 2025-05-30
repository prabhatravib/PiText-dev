def sanitize_mermaid(snippet: str) -> str:
    text = snippet.strip()
    
    # Decode HTML entities
    text = text.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"')

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
