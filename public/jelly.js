import { html, useEffect, useMemo, useRef } from 'https://esm.sh/htm@3.1.1/preact/standalone';

// Jelly speech-bubble faces.
export const COLORS = ['purple', 'teal', 'amber', 'pink', 'blue', 'lime'];
export const EYES = ['pill', 'oval', 'wide', 'square'];
export const MOUTHS = ['smile', 'grin', 'smirk', 'flat'];
export const STYLES = [['jelly', 'Pastel Jelly'], ['glass', 'Liquid Glass'], ['shadow', 'Shadow Jelly']];

const EYE_SHAPES = {
  pill: html`<rect x="-7" y="-13" width="14" height="26" rx="7" />`,
  wide: html`<ellipse rx="11" ry="8" />`,
  square: html`<rect x="-9" y="-10" width="18" height="20" rx="5" />`,
  oval: html`<ellipse rx="8" ry="11" />`,
};
const MOUTH_PATHS = { smile: 'M -13 0 Q 0 16 13 0', grin: 'M -17 -2 Q 0 23 17 -2', smirk: 'M -12 3 Q 3 12 13 -1', flat: 'M -10 6 L 10 6' };
const BODY = 'M 75 13 C 111 13 134 36 134 72 C 134 99 120 115 101 122 Q 92 127 82 139 Q 80 141 76 127 C 44 131 17 111 17 74 C 17 38 39 13 75 13Z';
let uid = 0;

// One shared animation loop and pointer listener for every face on the page.
const faces = new Set();
let pointer = null;
let loop = 0;
function tick(t) {
  for (const f of faces) {
    const svg = f.svg.current;
    if (!svg) continue;
    const r = svg.getBoundingClientRect();
    if (!r.width) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.45;
    const dx = pointer ? pointer.x - cx : Math.sin(t / 1100 + f.phase) * 30;
    const dy = pointer ? pointer.y - cy : Math.cos(t / 1500 + f.phase) * 20;
    const dist = Math.hypot(dx, dy) || 1;
    // Eyes look toward the cursor anywhere on the page, a little less when it is far away.
    const pull = pointer ? Math.max(0.35, 1 - dist / 900) : 0.14;
    const x = (dx / dist) * 12 * pull, y = (dy / dist) * 9 * pull;
    const excited = t < f.excitedUntil || f.busy.current;
    const bob = Math.sin(t / 790 + f.phase * 1.9) * 1.7 * (r.width / 150 + 0.4);
    const squish = excited ? 1 + Math.sin(t / 85) * 0.06 : 1 + Math.sin(t / 1100 + f.phase) * 0.014;
    svg.style.transform = `translateY(${bob}px) rotate(${x * 0.27}deg) scale(${squish},${2 - squish})`;
    if (t >= f.blinkEnd && Math.random() < 0.0015) f.blinkEnd = t + 130;
    const blink = t < f.blinkEnd ? 0.08 : 1;
    f.left.current?.setAttribute('transform', `translate(${54 + x} ${66 + y}) scale(1 ${blink})`);
    f.right.current?.setAttribute('transform', `translate(${95 + x * 1.1} ${66 + y}) scale(1 ${blink})`);
    f.mouth.current?.setAttribute('transform', `translate(${75 + x * 0.45} ${91 + y * 0.3}) scale(${excited ? 1.25 : 1})`);
  }
  loop = faces.size ? requestAnimationFrame(tick) : 0;
}
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
if (typeof document !== 'undefined') document.addEventListener('pointermove', (e) => (pointer = { x: e.clientX, y: e.clientY }));

/** A jelly face. Eyes follow the cursor; `busy` makes it jiggle; clicking a big one makes it jiggle too. */
export function Jelly({ look = {}, size = 44, live = false, busy = false, label = '' }) {
  const id = useMemo(() => `j${++uid}`, []);
  const color = `var(--jelly-${COLORS.includes(look.color) ? look.color : 'purple'})`;
  const style = look.style || 'jelly';
  const feature = style === 'shadow' ? 'white' : 'var(--jelly-ink)';
  const refs = { svg: useRef(null), left: useRef(null), right: useRef(null), mouth: useRef(null) };
  const busyRef = useRef(busy);
  busyRef.current = busy;

  useEffect(() => {
    if (reduced) return;
    const face = { ...refs, busy: busyRef, phase: Math.random() * 6, excitedUntil: 0, blinkEnd: 0 };
    const poke = () => (face.excitedUntil = performance.now() + 900);
    if (live) refs.svg.current?.addEventListener('click', poke);
    faces.add(face);
    if (!loop) loop = requestAnimationFrame(tick);
    return () => { faces.delete(face); refs.svg.current?.removeEventListener('click', poke); };
  }, []);

  const body = style === 'shadow' ? 'var(--jelly-shadow)' : `url(#${id}g)`;
  const stroke = style === 'glass' ? 'white' : color;
  return html`<svg ref=${refs.svg} class="jelly" width=${size} height=${size} viewBox="0 0 150 150"
      role=${label ? 'img' : null} aria-label=${label || null} aria-hidden=${label ? null : 'true'}>
    <defs>
      <linearGradient id=${id + 'g'} x1="0" y1="0" x2=".9" y2="1">
        <stop offset="0" style="stop-color:white" stop-opacity=".85" />
        <stop offset=".32" style=${'stop-color:' + color} stop-opacity=".55" />
        <stop offset="1" style=${'stop-color:' + color} stop-opacity=".98" />
      </linearGradient>
      <radialGradient id=${id + 's'} cx=".25" cy=".12" r=".85">
        <stop offset="0" stop-color="white" stop-opacity=".75" />
        <stop offset=".6" stop-color="white" stop-opacity=".05" />
        <stop offset="1" stop-color="white" stop-opacity="0" />
      </radialGradient>
    </defs>
    <path d=${BODY} style=${`fill:${body};stroke:${stroke}`} stroke-opacity=${style === 'glass' ? 0.9 : 0.45} stroke-width=${style === 'shadow' ? 2.5 : 1.5} />
    <path d=${BODY} fill=${`url(#${id}s)`} opacity=${style === 'shadow' ? 0.12 : 1} />
    <path d="M 32 50 Q 43 22 78 23" fill="none" stroke="white" stroke-opacity=${style === 'shadow' ? 0.55 : 0.68} stroke-width="7" stroke-linecap="round" />
    <ellipse cx="116" cy="91" rx="5" ry="11" transform="rotate(28 116 91)" fill="white" opacity=${style === 'glass' ? 0.65 : style === 'shadow' ? 0.09 : 0.24} />
    <g ref=${refs.left} transform="translate(54 66)"><g class="eye" style=${'fill:' + feature}>${EYE_SHAPES[look.eyes] || EYE_SHAPES.oval}</g></g>
    <g ref=${refs.right} transform="translate(95 66)"><g class="eye" style=${'fill:' + feature}>${EYE_SHAPES[look.eyes] || EYE_SHAPES.oval}</g></g>
    <g ref=${refs.mouth} transform="translate(75 91)">
      <path d=${MOUTH_PATHS[look.mouth] || MOUTH_PATHS.smile} style=${'stroke:' + feature} stroke-width="5" fill="none" stroke-linecap="round" />
    </g>
  </svg>`;
}
