// helpers.js

/**
 * Replace the container's contents with a generic "Something went wrong" UI.
 */
export function showErrorMessage(container) {
  container.innerHTML = `
    <div class="error-message">
      <div class="error-icon">⚠️</div>
      <div class="error-text">Something went wrong. Please generate again.</div>
      <button class="retry-btn" onclick="window.generateDiagram()">Retry</button>
    </div>
  `;
}

/**
 * After Mermaid renders an SVG inside `container`, force every path/polyline/marker
 * to use stroke=black, stroke-width=4, and drop-shadow, so arrows remain visible.
 */
export function forceArrowVisibility(container) {
  setTimeout(() => {
    const svg = container.querySelector('svg');
    if (!svg) return;

    // All path elements (arrows / connections)
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

    // Arrowhead markers (marker > path or marker > polygon)
    const markers = svg.querySelectorAll('marker path, marker polygon');
    markers.forEach(m => {
      m.setAttribute('fill', '#000000');
      m.setAttribute('stroke', '#ffffff');
      m.setAttribute('stroke-width', '2');
    });

    // All polylines
    const polylines = svg.querySelectorAll('polyline');
    polylines.forEach(p => {
      p.setAttribute('stroke', '#000000');
      p.setAttribute('stroke-width', '4');
      p.setAttribute('fill', 'none');
      p.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,0.9))';
    });

    // Edge paths specifically (Mermaid often places these in g.edgePath)
    const edgePaths = svg.querySelectorAll('g.edgePath path, g.edgePaths path, .edgePath path');
    edgePaths.forEach(e => {
      e.setAttribute('stroke', '#000000');
      e.setAttribute('stroke-width', '4');
      e.setAttribute('fill', 'none');
      e.style.filter = 'drop-shadow(0 0 3px rgba(255,255,255,0.9))';
    });
  }, 50);
}

/**
 * Decode HTML entities from a string (e.g., "&lt;" → "<").
 */
export function decodeHTMLEntities(text) {
  const ta = document.createElement('textarea');
  ta.innerHTML = text;
  return ta.value;
}
