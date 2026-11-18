import { html, useEffect, useRef, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';

const KIND = { hub: 'Hub', gateway: 'Hub', project: 'Hub', fact: 'Fact', decision: 'Decision', risk: 'Risk', artifact: 'Source' };

/** Find a note in any brain. Ctrl+K (or Cmd+K) jumps here from anywhere; Escape closes. */
export function Search({ brainId, onOpen }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); input.current?.select(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const n = ++seq.current;
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}&brain=${encodeURIComponent(brainId || '')}`).then((r) => r.json())
        .then((xs) => { if (n === seq.current) { setHits(Array.isArray(xs) ? xs : []); setActive(0); } }, () => {});
    }, 150);
    return () => clearTimeout(t);
  }, [q, brainId]);

  const pick = (h) => { if (!h) return; onOpen(h); setOpen(false); input.current?.blur(); };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') pick(hits[active]);
  };

  return html`<div class="search" onFocusOut=${(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
    <input ref=${input} type="search" class="search-input" placeholder="Search notes  (Ctrl+K)" aria-label="Search notes in every brain"
      value=${q} onInput=${(e) => { setQ(e.target.value); setOpen(true); }} onFocus=${() => setOpen(true)} onKeyDown=${onKeyDown} />
    ${open && q.trim().length >= 2 ? html`<ul class="search-results" role="listbox">
      ${hits.length === 0 ? html`<li class="search-empty">No notes match.</li>` : hits.map((h, i) => html`
        <li><button class=${i === active ? 'active' : ''} onMouseEnter=${() => setActive(i)} onClick=${() => pick(h)}>
          <span class="search-title">${h.title}</span>
          <span class="search-meta">${KIND[h.type] || 'Note'}${h.brainId !== brainId ? ` · ${h.brainName}` : ''}</span>
        </button></li>`)}
    </ul>` : null}
  </div>`;
}
