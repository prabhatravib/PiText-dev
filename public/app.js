// Wait for mermaid to be available (it's loaded as a module in index.html)
let mermaidReady = false;
const checkMermaid = setInterval(() => {
  if (window.mermaid) {
    mermaidReady = true;
    clearInterval(checkMermaid);
  }
}, 100);

// ---------- state ----------
let selectedElement = null;
let selectedText   = '';
let currentQuery   = '';

// ---------- UI wiring ----------
document.getElementById('generateBtn').onclick  = generateDiagram;
document.getElementById('askBtn').onclick       = askAboutSelection;
document.getElementById('deepDiveQuery').addEventListener('keypress', e => {
  if (e.key === 'Enter') askAboutSelection();
});
document.getElementById('query').addEventListener('keypress', e => {
  if (e.key === 'Enter') generateDiagram();
});

// -----------------------------------------------------------------------------
//  >>> NEW <<<  utility creators (copy / save buttons)
// -----------------------------------------------------------------------------

// Creates Copy + Save-PNG buttons for the diagram once it’s rendered
function addDiagramUtilities(diagramHost) {                        // >>> NEW <<<
  if (!diagramHost || diagramHost.querySelector('.diagram-utils')) return;

  const utils = document.createElement('div');
  utils.className = 'diagram-utils';

  // --- Copy SVG ---------------------------------------------------
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.onclick = () => {
    const svg = diagramHost.querySelector('svg');
    if (!svg) return;
    const svgTxt = new XMLSerializer().serializeToString(svg);
    navigator.clipboard.writeText(svgTxt);
  };

  // --- Download PNG ----------------------------------------------
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save PNG';
  saveBtn.onclick = () => {
    const svg = diagramHost.querySelector('svg');
    if (!svg) return;

    const svgTxt  = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgTxt], { type: 'image/svg+xml;charset=utf-8' });
    const url     = URL.createObjectURL(svgBlob);
    const img     = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href      = URL.createObjectURL(blob);
        a.download  = 'flowchart.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 250);
      }, 'image/png');
    };

    img.src = url;
  };

  utils.append(copyBtn, saveBtn);
  diagramHost.prepend(utils);
}

// Creates Copy + Save-TXT buttons for the deep-dive panel
function addDeepDiveUtilities(panel) {                             // >>> NEW <<<
  if (!panel || panel.querySelector('.deep-utils')) return;

  const utils = document.createElement('div');
  utils.className = 'deep-utils';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.onclick = () => navigator.clipboard.writeText(panel.innerText.trim());

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save TXT';
  saveBtn.onclick = () => {
    const blob = new Blob([panel.innerText.trim()], { type: 'text/plain' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'deep-dive.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 250);
  };

  utils.append(copyBtn, saveBtn);
  panel.prepend(utils);
}

// -----------------------------------------------------------------------------
//  generate diagram
// -----------------------------------------------------------------------------
async function generateDiagram() {
  if (!mermaidReady) {
    console.error('Mermaid not ready yet');
    return;
  }

  const q   = document.getElementById('query').value.trim();
  const res = document.getElementById('result');

  if (!q) {
    res.textContent = 'Please enter a query.';
    return;
  }

  currentQuery = q;
  resetSelection();
  res.textContent = 'Generating...';

  try {
    const r = await fetch('/describe', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: q })
    });

    const data = await r.json();
    if (!data.success) throw new Error(data.detail || 'Unknown error');

    // Inject the Mermaid snippet
    res.innerHTML = `<div class="mermaid">${data.diagram}</div>`;

    // Try to render with Mermaid and handle errors
    try {
      await window.mermaid.init(undefined, res.querySelector('.mermaid'));

      forceArrowVisibility(res);
      setupTextSelection(res);
      addDiagramUtilities(res);               // >>> NEW <<<  add buttons

      // Check for Mermaid errors after a short delay
      setTimeout(() => {
        const errorElement = res.querySelector('.mermaidError, [data-mermaid-error], .error');
        const hasErrorText = res.textContent.includes('Syntax error') ||
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

// -----------------------------------------------------------------------------
//  show error message
// -----------------------------------------------------------------------------
function showErrorMessage(container) {
  container.innerHTML = `
    <div class="error-message">
      <div class="error-icon">⚠️</div>
      <div class="error-text">Something went wrong. Please generate again.</div>
      <button class="retry-btn" onclick="generateDiagram()">Retry</button>
    </div>
  `;
}

// -----------------------------------------------------------------------------
//  reset selection
// -----------------------------------------------------------------------------
function resetSelection() {
  if (selectedElement) {
    selectedElement.classList.remove('node-selected');
    // Remove bold from edge label if it was selected
    if (selectedElement.classList && selectedElement.classList.contains('edgeLabel')) {
      const labelText = selectedElement.querySelector('text');
      if (labelText) labelText.style.fontWeight = 'normal';
    }
  }

  selectedElement = null;
  selectedText    = '';
  document.getElementById('selectionIndicator').classList.remove('active');
  document.getElementById('deepDiveQuery').value = '';
  document.getElementById('deepDiveResponse').classList.remove('active');
}

// -----------------------------------------------------------------------------
//  node / edge clicks
// -----------------------------------------------------------------------------
function setupTextSelection(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;

  // ----- Node click -----
  const nodes = svg.querySelectorAll('g.node');
  nodes.forEach(node => {
    node.style.cursor = 'pointer';

    node.addEventListener('click', function () {
      // Remove previous selection
      if (selectedElement) {
        selectedElement.classList.remove('node-selected');
        if (selectedElement.classList.contains('edgeLabel')) {
          const prevText = selectedElement.querySelector('text');
          if (prevText) prevText.style.fontWeight = 'normal';
        }
      }

      // Add selection to clicked node
      this.classList.add('node-selected');
      selectedElement = this;

      // Extract text from the node
      let nodeText    = '';
      const textEl    = this.querySelector('text');

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

      // Clean up whitespace and decode entities
      nodeText = decodeHTMLEntities(nodeText.replace(/\s+/g, ' ').trim());

      // Update selection
      selectedText = nodeText;
      document.getElementById('selectedText').textContent = nodeText;
      document.getElementById('selectionIndicator').classList.add('active');
      document.getElementById('deepDiveQuery').focus();
    });
  });

  // ----- Edge label click -----
  const edgeLabels = svg.querySelectorAll('.edgeLabel');
  edgeLabels.forEach(label => {
    label.style.cursor = 'pointer';

    label.addEventListener('click', function (e) {
      e.stopPropagation();

      // Remove previous selection
      if (selectedElement) {
        selectedElement.classList.remove('node-selected');
        if (selectedElement.classList.contains('edgeLabel')) {
          const prevText = selectedElement.querySelector('text');
          if (prevText) prevText.style.fontWeight = 'normal';
        }
      }

      // Bold this edge label's text
      const labelText = this.querySelector('text');
      if (labelText) labelText.style.fontWeight = 'bold';

      selectedElement = this;

      // Extract text
      const text = this.textContent.trim();
      selectedText = text;
      document.getElementById('selectedText').textContent = text;
      document.getElementById('selectionIndicator').classList.add('active');
      document.getElementById('deepDiveQuery').focus();
    });
  });

  // Click on empty space to deselect
  svg.addEventListener('click', function (e) {
    if (e.target === svg ||
        (e.target.tagName === 'rect' && e.target.getAttribute('fill') === 'none')) {
      resetSelection();
    }
  });
}

// Helper: decode HTML entities
function decodeHTMLEntities(text) {
  const ta = document.createElement('textarea');
  ta.innerHTML = text;
  return ta.value;
}

// -----------------------------------------------------------------------------
//  deep-dive
// -----------------------------------------------------------------------------
async function askAboutSelection() {
  const q = document.getElementById('deepDiveQuery').value.trim();
  if (!q || !selectedText) return;

  const respDiv = document.getElementById('deepDiveResponse');
  respDiv.innerHTML = '<div>Answering...</div>';   // if you are an llm don't change this line
  respDiv.classList.add('active');

  try {
    const r = await fetch('/deep-dive', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selected_text : selectedText,
        question      : q,
        original_query: currentQuery
      })
    });

    const data = await r.json();
    if (!data.success) throw new Error(data.detail || 'Unknown error');

    respDiv.innerHTML = `
      <h3>Deep Dive: ${selectedText}</h3>
      <div class="question">Q: ${q}</div>
      <div class="answer">${data.response}</div>`;

    addDeepDiveUtilities(respDiv);              // >>> NEW <<<  add buttons
    document.getElementById('deepDiveQuery').value = '';
  } catch (err) {
    respDiv.innerHTML = `<div style="color:#ff6b6b;">Error: ${err.message}</div>`;
  }
}

// -----------------------------------------------------------------------------
//  arrow styling helper
// -----------------------------------------------------------------------------
function forceArrowVisibility(container) {
  setTimeout(() => {
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Force all path elements (arrows / connections) to be black and thick
    const paths = svg.querySelectorAll('path');
    paths.forEach(path => {
      const d = path.getAttribute('d');
      if (d && d.includes('M') && d.includes('L')) {
        path.setAttribute('stroke', '#000000');
        path.setAttribute('stroke-width', '4');
        path.setAttribute('fill', 'none');
        path.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,0.9))';
      }
    });

    // Arrowheads
    const markers = svg.querySelectorAll('marker path, marker polygon');
    markers.forEach(m => {
      m.setAttribute('fill',   '#000000');
      m.setAttribute('stroke', '#ffffff');
      m.setAttribute('stroke-width', '2');
    });

    // Polylines
    const polylines = svg.querySelectorAll('polyline');
    polylines.forEach(p => {
      p.setAttribute('stroke', '#000000');
      p.setAttribute('stroke-width', '4');
      p.setAttribute('fill', 'none');
      p.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,0.9))';
    });

    // Edge paths specifically
    const edgePaths = svg.querySelectorAll('g.edgePath path, g.edgePaths path, .edgePath path');
    edgePaths.forEach(e => {
      e.setAttribute('stroke', '#000000');
      e.setAttribute('stroke-width', '4');
      e.setAttribute('fill', 'none');
      e.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,0.9))';
    });
  }, 50);
}
