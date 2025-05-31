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
    
    // Inject the Mermaid snippet
    res.innerHTML = `<div class="mermaid">${data.diagram}</div>`;
    
    // Try to render with Mermaid and handle errors
    try {
      await window.mermaid.init(undefined, res.querySelector('.mermaid'));
      
      // Force arrow visibility
      forceArrowVisibility(res);
      
      // Setup text selection
      setupTextSelection(res);
      
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

// ---------- reset selection ----------
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
  selectedText = '';
  document.getElementById('selectionIndicator').classList.remove('active');
  document.getElementById('deepDiveQuery').value = '';
  document.getElementById('deepDiveResponse').classList.remove('active');
}

// ---------- node / edge clicks ----------
function setupTextSelection(container) {
  const svg = container.querySelector('svg');
  if (!svg) return;
  
  // Node click
  const nodes = svg.querySelectorAll('g.node');
  nodes.forEach(node => {
    node.style.cursor = 'pointer';
    
    node.addEventListener('click', function(e) {
      // Remove previous selection
      if (selectedElement) {
        selectedElement.classList.remove('node-selected');
        if (selectedElement.classList && selectedElement.classList.contains('edgeLabel')) {
          const prevText = selectedElement.querySelector('text');
          if (prevText) prevText.style.fontWeight = 'normal';
        }
      }
      
      // Add selection to clicked node
      this.classList.add('node-selected');
      selectedElement = this;
      
      // Extract text from the node
      let nodeText = '';
      const textElement = this.querySelector('text');
      
      if (textElement) {
        const tspans = textElement.querySelectorAll('tspan');
        if (tspans.length > 0) {
          const lines = Array.from(tspans).map(tspan => tspan.textContent.trim());
          nodeText = lines.filter(line => line).join(' ');
        } else {
          nodeText = textElement.textContent.trim();
        }
      }
      
      if (!nodeText) {
        const nodeLabel = this.querySelector('.nodeLabel');
        if (nodeLabel) {
          nodeText = nodeLabel.textContent.trim();
        }
      }
      
      // Clean up whitespace and decode HTML entities
      nodeText = nodeText.replace(/\s+/g, ' ').trim();
      nodeText = decodeHTMLEntities(nodeText);
      
      // Update selection
      selectedText = nodeText;
      document.getElementById('selectedText').textContent = nodeText;
      document.getElementById('selectionIndicator').classList.add('active');
      document.getElementById('deepDiveQuery').focus();
    });
  });
  
  // Edge label click
  const edgeLabels = svg.querySelectorAll('.edgeLabel');
  edgeLabels.forEach(label => {
    label.style.cursor = 'pointer';
    
    label.addEventListener('click', function(e) {
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
  svg.addEventListener('click', function(e) {
    if (e.target === svg || (e.target.tagName === 'rect' && e.target.getAttribute('fill') === 'none')) {
      resetSelection();
    }
  });
}

// Helper function to decode HTML entities
function decodeHTMLEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// ---------- deep-dive ----------
async function askAboutSelection() {
  const q = document.getElementById('deepDiveQuery').value.trim();
  if (!q || !selectedText) return;
  
  const respDiv = document.getElementById('deepDiveResponse');
  respDiv.innerHTML = '<div>Thinking...</div>';
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
    respDiv.innerHTML = `<div style="color:#ff6b6b;">Error: ${err.message}</div>`;
  }
}

// ---------- arrow styling helper ----------
function forceArrowVisibility(container) {
  setTimeout(() => {
    const svg = container.querySelector('svg');
    if (!svg) return;
    
    // Force all path elements (arrows/connections) to be black and thick
    const paths = svg.querySelectorAll('path');
    paths.forEach(path => {
      const pathData = path.getAttribute('d');
      if (pathData && (pathData.includes('M') && pathData.includes('L'))) {
        path.setAttribute('stroke', '#000000');
        path.setAttribute('stroke-width', '4');
        path.setAttribute('fill', 'none');
        path.style.filter = 'drop-shadow(0 0 3px rgba(255, 255, 255, 0.9))';
      }
    });
    
    // Force all markers (arrowheads) to be black with white outline
    const markers = svg.querySelectorAll('marker path, marker polygon');
    markers.forEach(marker => {
      marker.setAttribute('fill', '#000000');
      marker.setAttribute('stroke', '#ffffff');
      marker.setAttribute('stroke-width', '2');
    });
    
    // Force all polylines to be black
    const polylines = svg.querySelectorAll('polyline');
    polylines.forEach(polyline => {
      polyline.setAttribute('stroke', '#000000');
      polyline.setAttribute('stroke-width', '4');
      polyline.setAttribute('fill', 'none');
      polyline.style.filter = 'drop-shadow(0 0 3px rgba(255, 255, 255, 0.9))';
    });
    
    // Force edge paths specifically
    const edgePaths = svg.querySelectorAll('g.edgePath path, g.edgePaths path, .edgePath path');
    edgePaths.forEach(edge => {
      edge.setAttribute('stroke', '#000000');
      edge.setAttribute('stroke-width', '4');
      edge.setAttribute('fill', 'none');
      edge.style.filter = 'drop-shadow(0 0 3px rgba(255, 255, 255, 0.9))';
    });
  }, 50);
}