// diagramUtilities.js

/**
 * Once a Mermaid diagram is rendered inside `diagramHost`,
 * prepend “Copy” and “Save PNG” buttons for convenience.
 */
export function addDiagramUtilities(diagramHost) {
  if (!diagramHost || diagramHost.querySelector('.diagram-utils')) return;

  const utils = document.createElement('div');
  utils.className = 'diagram-utils';

  // --- Copy SVG button ---
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.onclick = () => {
    const svg = diagramHost.querySelector('svg');
    if (!svg) return;
    const svgTxt = new XMLSerializer().serializeToString(svg);
    navigator.clipboard.writeText(svgTxt);
  };

  // --- Save PNG button ---
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save PNG';
  saveBtn.onclick = () => {
    const svg = diagramHost.querySelector('svg');
    if (!svg) return;

    // 1) Clone for resizing
    const clone = svg.cloneNode(true);
    const viewBox = (clone.getAttribute('viewBox') || '').split(' ').map(Number);
    let vbW, vbH;

    if (viewBox.length === 4) {
      vbW = viewBox[2];
      vbH = viewBox[3];
    } else {
      // Fallback: use SVG’s bounding box
      const bbox = svg.getBBox();
      vbW = bbox.width;
      vbH = bbox.height;
      clone.setAttribute('viewBox', \`0 0 \${vbW} \${vbH}\`);
    }

    // 2) Upscale (e.g. 4×)
    const SCALE = 4;
    clone.setAttribute('width', vbW * SCALE);
    clone.setAttribute('height', vbH * SCALE);

    const svgTxt = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgTxt], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // 3) Rasterize onto a canvas
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = vbW * SCALE;
      canvas.height = vbH * SCALE;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'flowchart.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 250);
      }, 'image/png');
    };
    img.src = url;
  };

  utils.append(copyBtn, saveBtn);
  diagramHost.prepend(utils);
}
