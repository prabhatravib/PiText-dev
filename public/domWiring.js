// domWiring.js
import { generateDiagram } from './mermaidInit.js';
import { askAboutSelection } from './deepDive.js';

// ——————————————————————————————————————————————————————————————
//  UI wiring: hook up “Generate” and “Ask” buttons + Enter key
// ——————————————————————————————————————————————————————————————
document.getElementById('generateBtn').onclick = generateDiagram;
document.getElementById('askBtn').onclick = askAboutSelection;

// Pressing “Enter” in #deepDiveQuery triggers askAboutSelection()
document.getElementById('deepDiveQuery').addEventListener('keypress', e => {
  if (e.key === 'Enter') askAboutSelection();
});

// Pressing “Enter” in #query triggers generateDiagram()
document.getElementById('query').addEventListener('keypress', e => {
  if (e.key === 'Enter') generateDiagram();
});

// For convenience, also expose generateDiagram globally so <button onclick="generateDiagram()"> works:
window.generateDiagram = generateDiagram;
