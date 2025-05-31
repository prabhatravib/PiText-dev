// selectionHandler.js
import { state } from './state.js';
import { decodeHTMLEntities } from './helpers.js';

/**
 * Given a container DIV that contains an SVG rendered by Mermaid,
 * wire up click‐handlers on nodes and edge labels so that clicking
 * selects text, toggles the “selected” class, and sets state.selectedText.
 */
export function setupTextSelection(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  // --- Node click handling ---
  const nodes = svg.querySelectorAll('g.node');
  nodes.forEach(node => {
    node.style.cursor = 'pointer';

    node.addEventListener('click', function () {
      // Deselect previous
      if (state.selectedElement) {
        state.selectedElement.classList.remove('node-selected');
        if (state.selectedElement.classList.contains('edgeLabel')) {
          const prevText = state.selectedElement.querySelector('text');
          if (prevText) prevText.style.fontWeight = 'normal';
        }
      }

      // Select new node
      this.classList.add('node-selected');
      state.selectedElement = this;

      // Extract text: either from <text><tspan>…</tspan></text> or .nodeLabel
      let nodeText = '';
      const textEl = this.querySelector('text');
      if (textEl) {
        const tspans = textEl.querySelectorAll('tspan');
        nodeText = tspans.length
          ? Array.from(tspans).map(t => t.textContent.trim()).filter(Boolean).join(' ')
          : textEl.textContent.trim();
      }
      if (!nodeText) {
        const nodeLabel = this.querySelector('.nodeLabel');
        if (nodeLabel) nodeText = nodeLabel.textContent.trim();
      }

      // Clean whitespace and decode entities
      nodeText = decodeHTMLEntities(nodeText.replace(/\s+/g, ' ').trim());

      // Update shared state + UI
      state.selectedText = nodeText;
      document.getElementById('selectedText').textContent = nodeText;
      document.getElementById('selectionIndicator').classList.add('active');
      document.getElementById('deepDiveQuery').focus();
    });
  });

  // --- Edge label click handling ---
  const edgeLabels = svg.querySelectorAll('.edgeLabel');
  edgeLabels.forEach(label => {
    label.style.cursor = 'pointer';

    label.addEventListener('click', function (e) {
      e.stopPropagation();

      // Deselect previous
      if (state.selectedElement) {
        state.selectedElement.classList.remove('node-selected');
        if (state.selectedElement.classList.contains('edgeLabel')) {
          const prevText = state.selectedElement.querySelector('text');
          if (prevText) prevText.style.fontWeight = 'normal';
        }
      }

      // Bold this label’s text
      const labelText = this.querySelector('text');
      if (labelText) labelText.style.fontWeight = 'bold';

      state.selectedElement = this;

      // Extract & store
      const text = this.textContent.trim();
      state.selectedText = text;
      document.getElementById('selectedText').textContent = text;
      document.getElementById('selectionIndicator').classList.add('active');
      document.getElementById('deepDiveQuery').focus();
    });
  });

  // --- Click on empty SVG canvas deselects everything ---
  svg.addEventListener('click', function (e) {
    if (
      e.target === svg ||
      (e.target.tagName === 'rect' && e.target.getAttribute('fill') === 'none')
    ) {
      resetSelection();
    }
  });
}

/**
 * Clear any prior selection state, both visually and in JS state.
 */
export function resetSelection() {
  if (state.selectedElement) {
    state.selectedElement.classList.remove('node-selected');
    // If it was an edgeLabel, revert fontWeight
    if (state.selectedElement.classList.contains('edgeLabel')) {
      const prevText = state.selectedElement.querySelector('text');
      if (prevText) prevText.style.fontWeight = 'normal';
    }
  }

  state.selectedElement = null;
  state.selectedText = '';
  document.getElementById('selectionIndicator').classList.remove('active');
  document.getElementById('deepDiveQuery').value = '';
  document.getElementById('deepDiveResponse').classList.remove('active');
}
