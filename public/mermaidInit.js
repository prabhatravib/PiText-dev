// mermaidInit.js
import { state } from './state.js';
import { setupTextSelection, resetSelection } from './selectionHandler.js';
import { addDiagramUtilities } from './diagramUtilities.js';
import { forceArrowVisibility, showErrorMessage } from './helpers.js';

// ——————————————————————————————————————————————————————————————
// 1) Wait for Mermaid to appear on window
// ——————————————————————————————————————————————————————————————
export let mermaidReady = false;
const checkMermaid = setInterval(() => {
  if (window.mermaid) {
    mermaidReady = true;
    clearInterval(checkMermaid);
  }
}, 100);

// ——————————————————————————————————————————————————————————————
// 2) generateDiagram()
// ——————————————————————————————————————————————————————————————
export async function generateDiagram() {
  if (!mermaidReady) {
    console.error('Mermaid not ready yet');
    return;
  }

  const q = document.getElementById('query').value.trim();
  const res = document.getElementById('result');

  if (!q) {
    res.textContent = 'Please enter a query.';
    return;
  }

  state.currentQuery = q;
  resetSelection();
  res.textContent = 'Generating...';

  try {
    const r = await fetch('/describe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q })
    });
    const data = await r.json();
    if (!data.success) throw new Error(data.detail || 'Unknown error');

    // Inject the Mermaid snippet into the result container
    res.innerHTML = \`<div class="mermaid">\${data.diagram}</div>\`;

    try {
      // Render with Mermaid
      await window.mermaid.init(undefined, res.querySelector('.mermaid'));

      // Make arrows visible, wire up node/edge selection, add buttons
      forceArrowVisibility(res);
      setupTextSelection(res);
      addDiagramUtilities(res);

      // After a short delay, check if any rendering errors slipped through
      setTimeout(() => {
        const errorElement = res.querySelector('.mermaidError, [data-mermaid-error], .error');
        const hasErrorText =
          res.textContent.includes('Syntax error') ||
          res.textContent.includes('Error') ||
          res.textContent.includes('error in text');
        const svg = res.querySelector('svg');

        if (errorElement || hasErrorText || !svg) {
          showErrorMessage(res);
        }
      }, 100);
    } catch (err) {
      showErrorMessage(res);
    }
  } catch (err) {
    showErrorMessage(res);
  }
}
