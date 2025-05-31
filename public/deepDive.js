// deepDive.js
import { state } from './state.js';

/**
 * Add “Copy” + “Save TXT” buttons to the deep-dive response panel.
 */
function addDeepDiveUtilities(panel) {
  if (!panel || panel.querySelector('.deep-utils')) return;

  const utils = document.createElement('div');
  utils.className = 'deep-utils';

  // Copy the entire panel’s innerText
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.onclick = () => navigator.clipboard.writeText(panel.innerText.trim());

  // Save panel text as a .txt file
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save TXT';
  saveBtn.onclick = () => {
    const blob = new Blob([panel.innerText.trim()], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'deep-dive.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 250);
  };

  utils.append(copyBtn, saveBtn);
  panel.prepend(utils);
}

/**
 * When a user types a follow-up in #deepDiveQuery and clicks “Ask” (or presses Enter),
 * client sends { selected_text, question, original_query } to /deep-dive and displays the response.
 */
export async function askAboutSelection() {
  const q = document.getElementById('deepDiveQuery').value.trim();
  if (!q || !state.selectedText) return;

  const respDiv = document.getElementById('deepDiveResponse');
  respDiv.innerHTML = '<div>Answering...</div>'; // do not change this line (LLM requirement)
  respDiv.classList.add('active');

  try {
    const r = await fetch('/deep-dive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selected_text: state.selectedText,
        question: q,
        original_query: state.currentQuery
      })
    });

    const data = await r.json();
    if (!data.success) throw new Error(data.detail || 'Unknown error');

    respDiv.innerHTML = `
      <h3>Deep Dive: ${state.selectedText}</h3>
      <div class="question">Q: ${q}</div>
      <div class="answer">${data.response}</div>
    `;
    addDeepDiveUtilities(respDiv);
    document.getElementById('deepDiveQuery').value = '';
  } catch (err) {
    respDiv.innerHTML = `<div style="color:#ff6b6b;">Error: ${err.message}</div>`;
  }
}
