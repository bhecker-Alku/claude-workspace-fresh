import { html, useEffect, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { Icon } from './cards.js';

/** In-page folder browser: works in any browser and on locked-down laptops (no Windows pop-up). */
export function FolderBrowser({ onAdd, onClose }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const go = (p) => fetch('/api/folders' + (p ? '?path=' + encodeURIComponent(p) : '')).then((r) => r.json()).then(setList);
  useEffect(() => { go(''); }, []);
  async function add(p) {
    setError('');
    const r = await fetch('/api/folders/add', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: p }) });
    const data = await r.json();
    if (r.ok) onAdd(data);
    else setError(data.error || 'Could not add that folder.');
  }
  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="dialog" role="dialog" aria-modal="true" aria-label="Add a folder">
      <header><strong>Add a brain or project</strong><span class="spacer"></span>
        <button class="btn ghost sm" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button></header>
      <p class="msg note">Pick a brain (marked Brain) or any project folder you want to chat in.</p>
      ${list ? html`
        <div class="crumb">
          <button class="btn sm" disabled=${!list.parent} onClick=${() => go(list.parent)}>Up</button>
          <code title=${list.path}>${list.path}</code>
        </div>
        <ul class="folders">
          ${list.folders.length === 0 ? html`<li class="msg note">No folders here.</li>` : null}
          ${list.folders.map((f) => html`<li>
            <button class="open" onClick=${() => go(f.path)}><${Icon} name=${f.isBrain ? 'brain' : 'chevron'} /> ${f.name}</button>
            ${f.isBrain ? html`<span class="badge ok">Brain</span>` : null}
            <button class="btn sm" onClick=${() => add(f.path)}>Add</button>
          </li>`)}
        </ul>
        ${error ? html`<div class="msg error" role="alert">${error}</div>` : null}
        <div class="actions"><button class="btn primary" onClick=${() => add(list.path)}>Add this folder</button></div>`
      : html`<div class="loader"></div>`}
    </div>
  </div>`;
}

/** Lists recent Claude Code chats in this folder so one can be continued here. */
export function ContinueChat({ brainId, onPick, onClose }) {
  const [sessions, setSessions] = useState(null);
  useEffect(() => { fetch(`/api/brains/${brainId}/claude-sessions`).then((r) => r.json()).then(setSessions, () => setSessions([])); }, [brainId]);
  const when = (iso) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="dialog" role="dialog" aria-modal="true" aria-label="Continue a Claude Code chat">
      <header><strong>Continue a Claude Code chat</strong><span class="spacer"></span>
        <button class="btn ghost sm" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button></header>
      <p class="msg note">Pick up a chat you started in Claude Code, with its history. Close it in the terminal first.</p>
      ${sessions === null ? html`<div class="loader"></div>`
        : sessions.length === 0 ? html`<p class="msg note">No Claude Code chats in this folder yet.</p>`
        : html`<ul class="folders">${sessions.map((s) => html`<li>
            <button class="open" onClick=${() => onPick(s.id)}>${s.title}<span class="when">${when(s.modified)}</span></button>
          </li>`)}</ul>`}
    </div>
  </div>`;
}
