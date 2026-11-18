import { html, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { Icon } from './cards.js';

const DEFAULT_NAME = 'Claude Workspace';
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Readable text on a color: dark on light colors, white on dark ones. */
const onColor = (hex) => (lum(hex) > 0.4 ? 'rgb(17, 17, 17)' : 'white');
/** A color token's current value, as the color pickers need a plain hex. */
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim().toUpperCase();

/** Puts a brand on screen: accent and sidebar colors, the tab title and icon. An empty brand restores the default look. */
export function applyBrand(b = {}) {
  const s = document.documentElement.style;
  const set = (name, hex, on) => { if (hex) { s.setProperty(name, hex); s.setProperty(on, onColor(hex)); } else { s.removeProperty(name); s.removeProperty(on); } };
  set('--air-accent', b.accent, '--air-on-accent');
  set('--air-ink', b.ink, '--air-on-ink');
  document.title = b.name || DEFAULT_NAME;
  const icon = document.querySelector('link[rel="icon"]');
  if (icon) icon.href = b.logo || 'logo.svg';
}

/** The logo as HTML: the brand's image when there is one, else the default logo. The server only keeps image data URLs. */
export const logoHtml = (b, fallback) => (b?.logo ? `<img class="brand-logo" src="${b.logo}" alt="">` : fallback);

const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })
  .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));

/** Branding: read a website's name, logo and colors, adjust them, save, or remove branding entirely. */
export function BrandDialog({ brand, onSaved, onClose }) {
  const [draft, setDraft] = useState({ ...brand });
  const [url, setUrl] = useState(brand.source || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = (k, v) => setDraft({ ...draft, [k]: v });

  async function read() {
    if (!url.trim()) return;
    setBusy('Reading the website…'); setError('');
    const r = await post('/api/brand/import', { url });
    setBusy('');
    if (!r.ok) return setError(r.data.error || 'Could not read that website.');
    setDraft({ ...draft, ...r.data });
    if (!r.data.logo && !r.data.accent) setError('Found little to use on that page. Set the colors and logo by hand below.');
  }
  function upload(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(png|jpeg|gif|webp|svg\+xml)$/.test(f.type) || f.size > 500_000) return setError('Use a PNG, JPG, GIF, WebP or SVG under 500 KB.');
    const reader = new FileReader();
    reader.onload = () => set('logo', String(reader.result));
    reader.readAsDataURL(f);
  }
  async function save() {
    setBusy('Saving…');
    const r = await post('/api/brand', draft);
    setBusy('');
    if (r.ok) onSaved(r.data); else setError(r.data.error || 'Could not save.');
  }
  async function remove() {
    if (!confirm('Remove branding? This deletes the saved name, logo and colors, and brings back the default look.')) return;
    setBusy('Removing…');
    await post('/api/brand/remove');
    setBusy('');
    onSaved({});
  }

  const accent = draft.accent || token('--air-accent'), ink = draft.ink || token('--air-ink');
  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="dialog brand-dialog" role="dialog" aria-modal="true" aria-label="Branding">
      <header><strong>Branding</strong><span class="spacer"></span>
        <button class="btn ghost sm" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button></header>
      <label class="field">Get it from a website
        <div class="brand-row">
          <input type="url" placeholder="example.com" value=${url} onInput=${(e) => setUrl(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && read()} />
          <button class="btn sm primary" disabled=${!!busy || !url.trim()} onClick=${read}>Read site</button>
        </div></label>
      <div class="brand-preview" style=${`background:${ink};color:${onColor(ink)}`} aria-label="Preview">
        ${draft.logo ? html`<img src=${draft.logo} alt="Logo" />` : html`<span>No logo</span>`}
        <strong>${draft.name || DEFAULT_NAME}</strong>
        <span class="chip" style=${`background:${accent};color:${onColor(accent)}`}>Accent</span>
      </div>
      <label class="field">Name<input value=${draft.name || ''} maxlength="40" placeholder=${DEFAULT_NAME} onInput=${(e) => set('name', e.target.value)} /></label>
      <div class="brand-colors">
        <label><input type="color" value=${accent} onInput=${(e) => set('accent', e.target.value.toUpperCase())} /> Accent (buttons, highlights)</label>
        <label><input type="color" value=${ink} onInput=${(e) => set('ink', e.target.value.toUpperCase())} /> Sidebar</label>
      </div>
      <div class="brand-row">
        <label class="btn sm">Upload logo<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" hidden onChange=${upload} /></label>
        ${draft.logo ? html`<button class="btn sm ghost" onClick=${() => set('logo', undefined)}>Clear logo</button>` : null}
      </div>
      ${busy ? html`<p class="app-wait">${busy}</p>` : null}
      ${error ? html`<div class="msg error" role="alert">${error}</div>` : null}
      <div class="actions">
        ${brand.name || brand.logo || brand.accent || brand.ink ? html`<button class="btn sm ghost danger" disabled=${!!busy} onClick=${remove}>Remove branding</button>` : null}
        <button class="btn" onClick=${onClose}>Cancel</button>
        <button class="btn primary" disabled=${!!busy} onClick=${save}>Save</button>
      </div>
    </div>
  </div>`;
}
