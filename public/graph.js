import { html, useEffect, useMemo, useRef, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'https://esm.sh/d3-force@3';

// Five categorical slots in fixed order, plus a neutral for the rest. Colors live in graph.css.
const GROUPS = [
  { key: 'hubs', label: 'Hubs', types: ['hub', 'gateway', 'project'] },
  { key: 'risks', label: 'Risks', types: ['risk'] },
  { key: 'facts', label: 'Facts', types: ['fact'] },
  { key: 'sources', label: 'Sources', types: ['artifact'] },
  { key: 'decisions', label: 'Decisions', types: ['decision'] },
  { key: 'other', label: 'Other', types: [] },
];
const groupOf = (type) => GROUPS.find((g) => g.types.includes(type)) ?? GROUPS[GROUPS.length - 1];
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fillOf = (g) => `var(--graph-${g.key})`;
const ink = () => ({
  text: cssVar('--air-text'), muted: cssVar('--air-muted'), surface: cssVar('--air-bg'), // ring and label halo match the page behind the map
  fills: Object.fromEntries(GROUPS.map((g) => [g.key, cssVar(`--graph-${g.key}`)])),
});

export function GraphView({ brainId, onOpen }) {
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(new Set());
  const [showOld, setShowOld] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const sim = useRef(null);
  const drawRef = useRef(() => {});
  const touched = useRef(false); // once the person pans or zooms, stop auto-fitting

  // Zoom and centre so every shown note fits, with room for labels.
  const fit = () => {
    const canvas = canvasRef.current;
    if (!canvas || !shown?.nodes.length) return;
    const xs = shown.nodes.map((n) => n.x), ys = shown.nodes.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const pad = 70;
    const k = Math.min(3, Math.max(0.2, Math.min((canvas.clientWidth - pad * 2) / (x1 - x0 || 1), (canvas.clientHeight - pad * 2) / (y1 - y0 || 1))));
    view.current = { k, x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k };
    drawRef.current();
  };

  useEffect(() => {
    setData(null); setSelected(null); touched.current = false;
    let stale = false; // a slower reply for a brain you already left is ignored
    const empty = { nodes: [], edges: [] };
    fetch(`/api/brains/${brainId}/graph`).then((r) => (r.ok ? r.json() : empty))
      .then((g) => !stale && setData(Array.isArray(g?.nodes) && Array.isArray(g?.edges) ? g : empty), () => !stale && setData(empty));
    return () => { stale = true; };
  }, [brainId]);

  // What is on screen after the legend, the old-notes switch and the search.
  const shown = useMemo(() => {
    if (!data) return null;
    const nodes = data.nodes.filter((n) => !hidden.has(groupOf(n.type).key) && (showOld || n.status !== 'deprecated')).map((n) => ({ ...n }));
    const ids = new Set(nodes.map((n) => n.id));
    const links = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ ...e }));
    const degree = new Map();
    for (const l of links) { degree.set(l.source, (degree.get(l.source) || 0) + 1); degree.set(l.target, (degree.get(l.target) || 0) + 1); }
    for (const n of nodes) { n.degree = degree.get(n.id) || 0; n.r = 4 + Math.sqrt(n.degree) * 1.6; }
    return { nodes, links };
  }, [data, hidden, showOld]);

  const q = query.trim().toLowerCase();
  const matches = (n) => !q || n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q);

  // Neighbours of the selected note, for highlighting and the side card.
  const neighbours = useMemo(() => {
    const set = new Set();
    if (!selected || !shown) return set;
    for (const l of shown.links) {
      const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
      if (s === selected.id) set.add(t);
      if (t === selected.id) set.add(s);
    }
    return set;
  }, [selected, shown]);

  drawRef.current = () => {
    const canvas = canvasRef.current;
    if (!canvas || !shown) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const ctx = canvas.getContext('2d');
    const { x, y, k } = view.current;
    const c = ink();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2 + x, h / 2 + y);
    ctx.scale(k, k);
    const focus = selected || hover;
    const lit = (n) => !focus || n.id === focus.id || (selected && neighbours.has(n.id));
    ctx.lineWidth = 1 / k;
    for (const l of shown.links) {
      const on = selected && (l.source.id === selected.id || l.target.id === selected.id);
      ctx.strokeStyle = c.text;
      ctx.globalAlpha = on ? 0.55 : selected ? 0.05 : 0.12;
      ctx.beginPath(); ctx.moveTo(l.source.x, l.source.y); ctx.lineTo(l.target.x, l.target.y); ctx.stroke();
    }
    for (const n of shown.nodes) {
      const g = groupOf(n.type);
      ctx.globalAlpha = (q && !matches(n)) || (selected && !lit(n)) ? 0.18 : 1;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = c.fills[g.key]; ctx.fill();
      ctx.lineWidth = (n.id === selected?.id ? 2.5 : 1.5) / k;
      ctx.strokeStyle = n.id === selected?.id ? c.text : c.surface; ctx.stroke();
    }
    // Labels: hubs always, plus whatever is in focus or matched; everything once zoomed in.
    ctx.font = `${12 / k}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const n of shown.nodes) {
      const want = k > 1.8 || groupOf(n.type).key === 'hubs' || n.id === hover?.id || n.id === selected?.id || (selected && neighbours.has(n.id)) || (q && matches(n));
      if (!want || (q && !matches(n)) || (selected && !lit(n))) continue;
      ctx.globalAlpha = 1;
      ctx.fillStyle = n.id === hover?.id || n.id === selected?.id ? c.text : c.muted;
      const label = n.title.length > 42 ? n.title.slice(0, 40) + '…' : n.title;
      ctx.lineJoin = 'round'; ctx.lineWidth = 4 / k; ctx.strokeStyle = c.surface;
      ctx.strokeText(label, n.x, n.y + n.r + 13 / k);
      ctx.fillText(label, n.x, n.y + n.r + 13 / k);
    }
    ctx.globalAlpha = 1;
  };

  useEffect(() => {
    if (!shown) return;
    sim.current?.stop();
    sim.current = forceSimulation(shown.nodes)
      .force('link', forceLink(shown.links).id((d) => d.id).distance(60).strength(0.4))
      .force('charge', forceManyBody().strength(-160))
      .force('center', forceCenter(0, 0))
      .force('x', forceX(0).strength(0.04)).force('y', forceY(0).strength(0.04))
      .force('collide', forceCollide((d) => d.r + 4))
      .stop();
    sim.current.tick(300); // settle the layout up front, then show it still
    if (touched.current) drawRef.current(); else fit();
    return () => sim.current?.stop();
  }, [shown]);

  useEffect(() => { drawRef.current(); }, [selected, hover, query, neighbours]);
  useEffect(() => {
    const ro = new ResizeObserver(() => drawRef.current());
    if (wrapRef.current) ro.observe(wrapRef.current);
    const mo = new MutationObserver(() => drawRef.current());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);

  // Screen point to graph point, and the note under it. The hit area is larger than the dot.
  const toGraph = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const { x, y, k } = view.current;
    return [(e.clientX - r.left - r.width / 2 - x) / k, (e.clientY - r.top - r.height / 2 - y) / k];
  };
  const hit = (e) => {
    if (!shown) return null;
    const [gx, gy] = toGraph(e);
    let best = null, bestD = Infinity;
    for (const n of shown.nodes) {
      const d = Math.hypot(n.x - gx, n.y - gy);
      if (d < n.r + 6 / view.current.k && d < bestD) { best = n; bestD = d; }
    }
    return best;
  };
  const drag = useRef(null);
  const onDown = (e) => { drag.current = { sx: e.clientX, sy: e.clientY, x: view.current.x, y: view.current.y, moved: false }; };
  const onMove = (e) => {
    if (drag.current) {
      const dx = e.clientX - drag.current.sx, dy = e.clientY - drag.current.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) { drag.current.moved = true; touched.current = true; }
      view.current.x = drag.current.x + dx; view.current.y = drag.current.y + dy;
      drawRef.current();
      return;
    }
    const n = hit(e);
    if ((n?.id ?? null) !== (hover?.id ?? null)) setHover(n);
    canvasRef.current.style.cursor = n ? 'pointer' : 'grab';
  };
  const onUp = (e) => {
    const moved = drag.current?.moved;
    drag.current = null;
    if (!moved) setSelected(hit(e));
  };
  const onWheel = (e) => {
    e.preventDefault();
    touched.current = true;
    const r = canvasRef.current.getBoundingClientRect();
    const v = view.current;
    const k = Math.min(5, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0015)));
    const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
    v.x = mx - ((mx - v.x) * k) / v.k; v.y = my - ((my - v.y) * k) / v.k; v.k = k;
    drawRef.current();
  };
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const counts = useMemo(() => {
    const m = new Map();
    for (const n of data?.nodes ?? []) if (showOld || n.status !== 'deprecated') m.set(groupOf(n.type).key, (m.get(groupOf(n.type).key) || 0) + 1);
    return m;
  }, [data, showOld]);
  const toggle = (key) => setHidden((s) => { const t = new Set(s); t.has(key) ? t.delete(key) : t.add(key); return t; });
  const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data]);
  const oldCount = (data?.nodes ?? []).filter((n) => n.status === 'deprecated').length;

  if (data === null) return html`<div class="graph"><div class="empty"><div class="loader"></div></div></div>`;
  if (!data.nodes.length) return html`<div class="graph"><div class="empty" style="padding: var(--air-s5)">This brain has no note map yet. It appears after the brain's graph is built.</div></div>`;

  return html`<div class="graph" ref=${wrapRef}>
    <div class="graph-bar">
      ${GROUPS.filter((g) => counts.get(g.key)).map((g) => html`<button class="chip" aria-pressed=${!hidden.has(g.key)} onClick=${() => toggle(g.key)}>
        <span class="dot" style=${{ background: fillOf(g) }}></span>${g.label} <span class="n">${counts.get(g.key)}</span></button>`)}
      ${oldCount ? html`<label class="chip"><input type="checkbox" checked=${showOld} onChange=${(e) => setShowOld(e.target.checked)} /> Show old notes <span class="n">${oldCount}</span></label>` : null}
      <span class="spacer"></span>
      <input class="graph-search" type="search" placeholder="Find a note" value=${query} onInput=${(e) => setQuery(e.target.value)} />
    </div>
    <canvas ref=${canvasRef} class="graph-canvas" role="img" aria-label=${`Map of ${shown?.nodes.length ?? 0} notes and how they link`}
      onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerLeave=${() => { drag.current = null; setHover(null); }}></canvas>
    ${hover && !selected ? html`<div class="graph-tip">${hover.title}<span>${groupOf(hover.type).label}${hover.status === 'deprecated' ? ' · old' : ''}</span></div>` : null}
    ${selected ? html`<aside class="graph-card">
      <div class="graph-card-head"><span class="dot" style=${{ background: fillOf(groupOf(selected.type)) }}></span>
        <span class="kind">${groupOf(selected.type).label}${selected.status ? ` · ${selected.status}` : ''}</span>
        <button class="btn ghost sm" aria-label="Close" onClick=${() => setSelected(null)}>×</button></div>
      <h3>${selected.title}</h3>
      ${selected.description ? html`<p>${selected.description}</p>` : null}
      ${selected.path ? html`<button class="btn sm" onClick=${() => onOpen(selected.path)}>Open note</button>` : null}
      ${neighbours.size ? html`<div class="graph-links"><div class="kind">Linked to ${neighbours.size}</div>
        <ul>${[...neighbours].map((id) => byId.get(id)).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title)).map((n) => html`
          <li><button onClick=${() => setSelected(shown.nodes.find((x) => x.id === n.id))}><span class="dot" style=${{ background: fillOf(groupOf(n.type)) }}></span>${n.title}</button></li>`)}</ul></div>` : null}
    </aside>` : null}
  </div>`;
}
