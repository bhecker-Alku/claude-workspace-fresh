import { html, useRef, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { Icon } from './cards.js';

const HOLD_MS = 1000;

/** Shut down by holding for a second while a ring fills. Letting go early cancels. Works with mouse, touch and keyboard. */
export function PowerButton({ onFire, busy = false }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef(null);
  const start = () => {
    if (busy || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => { timer.current = null; setHolding(false); onFire(); }, HOLD_MS);
  };
  const stop = () => { clearTimeout(timer.current); timer.current = null; setHolding(false); };
  const key = (fn) => (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); fn(); } };
  return html`<button class=${'power' + (holding ? ' holding' : '')} disabled=${busy}
      aria-label="Hold to shut down Claude Workspace" title=${busy ? 'Shutting down' : 'Hold to shut down'}
      onPointerDown=${start} onPointerUp=${stop} onPointerLeave=${stop} onPointerCancel=${stop}
      onKeyDown=${key(start)} onKeyUp=${key(stop)} onContextMenu=${(e) => e.preventDefault()}>
    <svg class="power-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" /></svg>
    <${Icon} name="power" />
    ${holding ? html`<span class="power-hint">Keep holding…</span>` : null}
  </button>`;
}

/** Shows only when the server's code changed since it started. One click restarts; brains that are working finish first. */
export function UpdateChip({ onRestart, busy = false }) {
  return html`<button class="update-chip" disabled=${busy} onClick=${onRestart} title="New code is waiting. Restart picks it up; working brains finish first.">
    <${Icon} name="sparkle" /> Update ready · Restart
  </button>`;
}
