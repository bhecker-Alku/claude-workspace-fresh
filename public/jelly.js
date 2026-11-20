import { html, useEffect, useMemo, useRef } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { PACKS, resolvePack } from './jelly-packs.js';

export { PACKS, resolvePack };
/** Avatar themes for the picker: the classic jelly first, then the packs in calendar order (any new pack goes last). */
const PACK_ORDER = ['halloween', 'christmas', 'pokipals'];
export const THEMES = [['classic', 'Classic'], ...[...PACK_ORDER, ...Object.keys(PACKS).filter((k) => !PACK_ORDER.includes(k))].filter((k) => PACKS[k]).map((k) => [k, PACKS[k].label])];

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
const CLASSIC_AT = { lx: 54, ly: 66, rx: 95, ry: 66, mx: 75, my: 91 };
const raw = (markup) => ({ __html: markup });

/** A face from a themed pack: costume behind, jelly body, costume in front, then eyes and mouth that move. */
function themedFace({ pack, character: c, eyes, mouth }, id, refs, { ref, size, label, box }) {
  const g = pack.gradient;
  const at = pack.at;
  const bodyPath = c.body || pack.bubble;
  const eye = pack.eyes[eyes][1];
  return html`<svg ref=${ref} class=${box === '0 0 150 150' ? 'jelly' : 'jelly zoomed'} width=${size} height=${size} viewBox=${box}
      role=${label ? 'img' : null} aria-label=${label || null} aria-hidden=${label ? null : 'true'}>
    <defs>
      <linearGradient id=${id + 'g'} x1=${g.x1} y1="0" x2=${g.x2} y2="1">
        <stop offset="0" stop-color=${c.light} /><stop offset=${g.mid} stop-color=${c.color} /><stop offset="1" stop-color=${c.color} />
      </linearGradient>
      <clipPath id=${id + 'c'}><path d=${bodyPath} /></clipPath>
    </defs>
    <g dangerouslySetInnerHTML=${raw(c.behind)} />
    <path d=${bodyPath} fill=${`url(#${id}g)`} stroke=${c.stroke || c.color} stroke-width=${c.strokeWidth || 2.5} />
    ${c.stripes ? html`<g clip-path=${`url(#${id}c)`} opacity=".24" fill="none" stroke=${c.stripes} stroke-width="17"><path d="M -40 39 L 78 157 M -8 7 L 110 125 M 24 -25 L 142 93 M 56 -57 L 174 61 M 88 -89 L 206 29" /></g>` : null}
    ${c.inner ? html`<g clip-path=${`url(#${id}c)`} dangerouslySetInnerHTML=${raw(c.inner)} />` : null}
    <g dangerouslySetInnerHTML=${raw(pack.glare + c.front)} />
    ${c.nose ? html`<g ref=${refs.nose} dangerouslySetInnerHTML=${raw(c.nose)} />` : null}
    <g style=${'color:' + c.ink}>
      <g ref=${refs.left} transform=${`translate(${at.lx} ${at.ly})`} dangerouslySetInnerHTML=${raw(eye)} />
      <g ref=${refs.right} transform=${`translate(${at.rx} ${at.ry})`} dangerouslySetInnerHTML=${raw(eye)} />
      <g ref=${refs.mouth} transform=${`translate(${at.mx} ${at.my})`} dangerouslySetInnerHTML=${raw(mouth ? pack.mouths[mouth][1] : '')} />
    </g>
  </svg>`;
}

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
    const at = f.at.current;
    f.left.current?.setAttribute('transform', `translate(${at.lx + x} ${at.ly + y}) scale(1 ${blink})`);
    f.right.current?.setAttribute('transform', `translate(${at.rx + x * 1.1} ${at.ry + y}) scale(1 ${blink})`);
    // Themed faces move mouth and nose together with the eyes, so the face shifts as one piece and nothing overlaps.
    const [fx, fy] = at.follow || [0.45, 0.3];
    f.mouth.current?.setAttribute('transform', `translate(${at.mx + x * fx} ${at.my + y * fy}) scale(${excited ? (at.follow ? 1.12 : 1.25) : 1})`);
    // A themed nose moves almost as far as the eyes, so the eyes never slide over it.
    f.nose.current?.setAttribute('transform', `translate(${x * fx} ${y * fy})`);
  }
  loop = faces.size ? requestAnimationFrame(tick) : 0;
}
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
if (typeof document !== 'undefined') document.addEventListener('pointermove', (e) => (pointer = { x: e.clientX, y: e.clientY }));

/** A jelly face. Eyes follow the cursor; `busy` makes it jiggle; clicking a big one makes it jiggle too. */
export function Jelly({ look = {}, size = 44, live = false, busy = false, label = '', zoom = false }) {
  const id = useMemo(() => `j${++uid}`, []);
  const color = `var(--jelly-${COLORS.includes(look.color) ? look.color : 'purple'})`;
  const style = look.style || 'jelly';
  const feature = style === 'shadow' ? 'white' : 'var(--jelly-ink)';
  const refs = { svg: useRef(null), left: useRef(null), right: useRef(null), mouth: useRef(null), nose: useRef(null) };
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const themed = resolvePack(look);
  const atRef = useRef(CLASSIC_AT);
  atRef.current = themed ? themed.pack.at : CLASSIC_AT;

  useEffect(() => {
    if (reduced) return;
    const face = { ...refs, at: atRef, busy: busyRef, phase: Math.random() * 6, excitedUntil: 0, blinkEnd: 0 };
    const poke = () => (face.excitedUntil = performance.now() + 900);
    if (live) refs.svg.current?.addEventListener('click', poke);
    faces.add(face);
    if (!loop) loop = requestAnimationFrame(tick);
    return () => { faces.delete(face); refs.svg.current?.removeEventListener('click', poke); };
  }, []);

  // zoom: a close-up of the face, for small eye and mouth previews.
  const box = zoom ? '30 40 90 90' : '0 0 150 150';
  const svgProps = { ref: refs.svg, size, label, box };
  if (themed) return themedFace(themed, id, refs, svgProps);

  const body = style === 'shadow' ? 'var(--jelly-shadow)' : `url(#${id}g)`;
  const stroke = style === 'glass' ? 'white' : color;
  return html`<svg ref=${refs.svg} class=${box === '0 0 150 150' ? 'jelly' : 'jelly zoomed'} width=${size} height=${size} viewBox=${box}
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
