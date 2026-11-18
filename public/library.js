import { html, useEffect, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { Icon } from './cards.js';

const when = (iso) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function Library({ brainId, onClose }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    setItems(null);
    fetch(`/api/brains/${brainId}/library`).then((r) => r.json()).then(setItems, () => setItems([]));
  }, [brainId]);
  const open = (path) => fetch(`/api/brains/${brainId}/library/open`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path }) });
  return html`<aside class="library" aria-label="Library">
    <header><${Icon} name="library" /><span style="margin-left: var(--air-s2)">Library</span><span class="spacer" style="flex:1"></span>
      <button class="btn ghost sm" aria-label="Close library" onClick=${onClose}><${Icon} name="x" /></button></header>
    ${items === null
      ? html`<div class="empty"><div class="loader"></div></div>`
      : items.length === 0
        ? html`<div class="empty" style="padding: var(--air-s5)">Nothing here yet. Things this brain makes will show up here.</div>`
        : html`<ul>${items.map((i) => html`<li><button onClick=${() => open(i.path)} title=${i.path}>${i.name}<span class="when">${when(i.modified)}</span></button></li>`)}</ul>`}
  </aside>`;
}
