// Initialize Mermaid with error handling
mermaid.initialize({ 
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'default',
  logLevel: 'error'
});

// ---------- state ----------
let selectedElement = null;
let selectedText = '';
let currentQuery = '';

// ---------- UI wiring ----------
document.getElementById('generateBtn').onclick = generateDiagram;
document.getElementById('askBtn').onclick = askAboutSelection;
document.getElementById('deepDiveQuery').addEventListener('keypress', e => {
  if (e.key === 'Enter') askAboutSelection();
});
document.getElementById('query').addEventListener('keypress', e => {
  if (e.key === 'Enter') generateDiagram();
});

// ---------- generate diagram ----------
async function generateDiagram() {
  const q = document.getElementById('query').value.trim();
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q })
    });
    
    const data = await r.json();
    if (!data.success) throw new Error(data.detail || 'Unknown error');
    
    // Create a temporary container for Mermaid
    res.innerHTML = `<div class="mermaid" id="mermaid-container">${data.diagram}</div>`;
    
    // Try to render with Mermaid
    try {
      await mermaid.init(undefined, res.querySelector('.mermaid'));
      
      // Check after a short delay to see if rendering succeeded
      setTimeout(() => {
        checkMermaidRendering(res);
      }, 100);
    } catch (mermaidError) {
      console.error('Mermaid rendering error:', mermaidError);
      showErrorMessage(res);
    }
  } catch (err) {
    console.error('Generation error:', err);
    showErrorMessage(res);
  }
}

// ---------- check if Mermaid rendered successfully ----------
function checkMermaidRendering(container) {
  const mermaidContainer = container.querySelector('#mermaid-container');
  
  // Check if Mermaid inserted an error message
  if (mermaidContainer && mermaidContainer.textContent.includes('Syntax error')) {
    showErrorMessage(container);
    return;
  }
  
  // Check if SVG was created
  const svg = container.querySelector('svg');
  if (!svg) {
    showErrorMessage(container);
    return;
  }
  
  // Check if SVG has actual content
  const hasNodes = svg.querySelector('g.node');
  if (!hasNodes) {
    showErrorMessage(container);
    return;
  }
  
  // Success - apply post-processing
  forceArrowVisibility(container);
  setupTextSelection(container);
}

// ---------- show error message ----------
function showErrorMessage(container) {
  container.innerHTML = `
    <div class="error-message">
      <div class="error-icon">⚠️</div>
      <div class="error-text">Something went wrong. Please generate again.</div>
      <button class="retry-btn" onclick="generateDiagram()">Retry</button>
    </div>
  `;
}

// ---------- node / edge clicks ----------
function setupTextSelection(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;
  
  // Node click
  svg.querySelectorAll('g.node').forEach(node => {
    node.style.cursor = 'pointer';
    node.onclick = () => {
      selectElement(node, extractNodeText(node));
    };
  });
  
  // Edge-label click
  svg.querySelectorAll('.edgeLabel').forEach(lbl => {
    lbl.style.cursor = 'pointer';
    lbl.onclick = e => {
      e.stopPropagation();
      selectElement(lbl, lbl.textContent.trim());
    };
  });
  
  // Blank click clears selection
  svg.onclick = e => {
    if (e.target === svg) {
      resetSelection();
    }
  };
}

function selectElement(el, text) {
  if (selectedElement) selectedElement.classList.remove('node-selected');
  
  el.classList.add('node-selected');
  selectedElement = el;
  selectedText = text || '';
  
  document.getElementById('selectedText').textContent = selectedText;
  document.getElementById('selectionIndicator').classList.add('active');
  document.getElementById('deepDiveQuery').focus();
}

function resetSelection() {
  if (selectedElement) selectedElement.classList.remove('node-selected');
  
  selectedElement = null;
  selectedText = '';
  
  document.getElementById('selectionIndicator').classList.remove('active');
  document.getElementById('deepDiveQuery').value = '';
  document.getElementById('deepDiveResponse').classList.remove('active');
}

// Helper function to decode HTML entities
function decodeHTMLEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// Extract text inside a node
function extractNodeText(node) {
  let t = '';
  const textEl = node.querySelector('text');
  
  if (textEl) {
    const ts = textEl.querySelectorAll('tspan');
    t = ts.length 
      ? Array.from(ts).map(x => x.textContent.trim()).filter(Boolean).join(' ')
      : textEl.textContent.trim();
  }
  
  if (!t) {
    const lbl = node.querySelector('.nodeLabel');
    if (lbl) t = lbl.textContent.trim();
  }
  
  // Decode HTML entities before returning
  return decodeHTMLEntities(t);
}

// ---------- deep-dive ----------
async function askAboutSelection() {
  const q = document.getElementById('deepDiveQuery').value.trim();
  if (!q || !selectedText) return;
  
  const respDiv = document.getElementById('deepDiveResponse');
  respDiv.innerHTML = '<div>Answering...</div>';
  respDiv.classList.add('active');
  
  try {
    const r = await fetch('/deep-dive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selected_text: selectedText,
        question: q,
        original_query: currentQuery
      })
    });
    
    const data = await r.json();
    if (!data.success) throw new Error(data.detail || 'Unknown error');
    
    respDiv.innerHTML = `
      <h3>Deep Dive: ${selectedText}</h3>
      <div class="question">Q: ${q}</div>
      <div class="answer">${data.response}</div>`;
    
    document.getElementById('deepDiveQuery').value = '';
  } catch (err) {
    respDiv.innerHTML = `<div style="color:#f66;">Error: ${err.message}</div>`;
  }
}

// ---------- arrow styling helper ----------
function forceArrowVisibility(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;
  
  // Lines
  svg.querySelectorAll('path').forEach(p => {
    const d = p.getAttribute('d') || '';
    if (d.includes('M') && d.includes('L')) {
      p.setAttribute('stroke', '#000');
      p.setAttribute('stroke-width', '4');
      p.setAttribute('fill', 'none');
      p.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,.9))';
    }
  });
  
  // Arrowheads
  svg.querySelectorAll('marker path, marker polygon').forEach(m => {
    m.setAttribute('fill', '#000');
    m.setAttribute('stroke', '#fff');
    m.setAttribute('stroke-width', '2');
  });
  
  // Polylines
  svg.querySelectorAll('polyline').forEach(pl => {
    pl.setAttribute('stroke', '#000');
    pl.setAttribute('stroke-width', '4');
    pl.setAttribute('fill', 'none');
    pl.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,.9))';
  });
}