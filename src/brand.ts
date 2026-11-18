import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** The app's look: a name, a logo (as a data URL) and two colors. No brand file means the plain default look. */
export type Brand = { name?: string; logo?: string; accent?: string; ink?: string; source?: string };

const file = (dataDir: string) => path.join(dataDir, 'brand.json');
const HEX = /^#[0-9a-f]{6}$/i;
const LOGO = /^data:image\/(png|jpeg|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=]+$/;
const MAX_LOGO = 700_000; // characters of data URL, about 500 KB of image

/** Keeps only fields that are safe to put on screen; anything else is dropped. */
export function cleanBrand(input: unknown): Brand {
  const b = (input ?? {}) as Record<string, unknown>;
  const out: Brand = {};
  if (typeof b.name === 'string' && b.name.trim()) out.name = b.name.trim().slice(0, 40);
  if (typeof b.logo === 'string' && b.logo.length <= MAX_LOGO && LOGO.test(b.logo)) out.logo = b.logo;
  if (typeof b.accent === 'string' && HEX.test(b.accent)) out.accent = b.accent.toUpperCase();
  if (typeof b.ink === 'string' && HEX.test(b.ink)) out.ink = b.ink.toUpperCase();
  if (typeof b.source === 'string' && /^https?:\/\//i.test(b.source)) out.source = b.source.slice(0, 300);
  return out;
}

export async function readBrand(dataDir: string): Promise<Brand> {
  try { return cleanBrand(JSON.parse(await readFile(file(dataDir), 'utf8'))); } catch { return {}; }
}

export async function saveBrand(dataDir: string, input: unknown): Promise<Brand> {
  const brand = cleanBrand(input);
  await mkdir(dataDir, { recursive: true });
  const tmp = `${file(dataDir)}.tmp`;
  await writeFile(tmp, JSON.stringify(brand, null, 2));
  await rename(tmp, file(dataDir));
  return brand;
}

/** Remove branding: deletes the saved name, logo and colors. The app goes back to its default look. */
export async function removeBrand(dataDir: string): Promise<void> {
  await rm(file(dataDir), { force: true });
}

// ---- Reading a website ----

const attrs = (tag: string) => {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  return out;
};
const tags = (html: string, name: string) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => attrs(m[0]));
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

function toHex(c: string): string | null {
  c = c.trim().toLowerCase();
  let m = c.match(/^#([0-9a-f]{3})$/);
  if (m) return '#' + [...m[1]].map((x) => x + x).join('').toUpperCase();
  m = c.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) return '#' + m[1].toUpperCase();
  m = c.match(/^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/);
  if (m) return '#' + [m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase();
  return null;
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lum = (hex: string) => { const [r, g, b] = rgb(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const sat = (hex: string) => { const [r, g, b] = rgb(hex); const max = Math.max(r, g, b), min = Math.min(r, g, b); return max === 0 ? 0 : (max - min) / max; };

/** Picks the brand colors from what a site uses: the accent is its most used strong color, the ink its most used near-black. */
export function pickColors(css: string, themeColor?: string): { accent?: string; ink?: string } {
  const count = new Map<string, number>();
  const add = (hex: string | null, w = 1) => { if (hex) count.set(hex, (count.get(hex) ?? 0) + w); };
  for (const m of css.matchAll(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b|#[0-9a-fA-F]{3}\b|rgba?\([^)]*\)/g)) add(toHex(m[0]));
  // Variables named like brand colors count extra.
  for (const m of css.matchAll(/--[\w-]*(primary|brand|accent|main)[\w-]*\s*:\s*([^;}]+)/gi)) add(toHex(m[2]), 8);
  const theme = themeColor ? toHex(themeColor) : null;
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);
  const strong = (h: string) => sat(h) > 0.35 && lum(h) > 0.03 && lum(h) < 0.8;
  const accent = (theme && strong(theme) ? theme : null) ?? ranked.find(strong);
  const ink = (theme && lum(theme) < 0.05 ? theme : null) ?? ranked.find((h) => lum(h) < 0.03 && h !== '#000000') ?? undefined;
  return { ...(accent ? { accent } : {}), ...(ink ? { ink } : {}) };
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function getText(url: string, f: Fetcher, max = 2_000_000): Promise<string> {
  const r = await f(url, { signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'Mozilla/5.0 (Claude Workspace branding)' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return (await r.text()).slice(0, max);
}

async function getImage(url: string, f: Fetcher): Promise<string | undefined> {
  try {
    const r = await f(url, { signal: AbortSignal.timeout(10_000), redirect: 'follow' });
    const type = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!r.ok || !type.startsWith('image/')) return undefined;
    const buf = Buffer.from(await r.arrayBuffer());
    const data = `data:${type};base64,${buf.toString('base64')}`;
    return data.length <= MAX_LOGO && LOGO.test(data) ? data : undefined;
  } catch { return undefined; }
}

/** Reads a website's name, logo and main colors. Returns a preview; nothing is saved until the person saves it. */
export async function importBrand(siteUrl: string, f: Fetcher = fetch): Promise<Brand> {
  let base: URL;
  try { base = new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`); } catch { throw new Error('That does not look like a website address.'); }
  if (!/^https?:$/.test(base.protocol)) throw new Error('Use a web address that starts with http or https.');
  const html = await getText(base.href, f);
  const abs = (u?: string) => { try { return u ? new URL(decode(u), base).href : undefined; } catch { return undefined; } };
  const metas = tags(html, 'meta');
  const meta = (key: string) => metas.find((m) => (m.property ?? m.name ?? '').toLowerCase() === key)?.content;

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  // A page title like "Home \ Anthropic" or "Acme | Welcome": keep the part that is not a generic page word.
  const fromTitle = decode(title ?? '').split(/\s[|\-–—:\\·•]\s/).map((x) => x.trim()).filter((x) => x && !/^(home|welcome|homepage|official site)$/i.test(x))[0] ?? '';
  const name = decode(meta('og:site_name') ?? meta('application-name') ?? fromTitle);

  const links = tags(html, 'link');
  const rel = (l: Record<string, string>) => (l.rel ?? '').toLowerCase();
  const size = (l: Record<string, string>) => Number((l.sizes ?? '').split('x')[0]) || 0;
  const logoImgs = tags(html, 'img').filter((i) => /logo/i.test(`${i.class ?? ''} ${i.id ?? ''} ${i.alt ?? ''} ${i.src ?? ''}`)).map((i) => abs(i.src));
  const candidates = [
    ...logoImgs,
    ...links.filter((l) => rel(l).includes('apple-touch-icon')).sort((a, b) => size(b) - size(a)).map((l) => abs(l.href)),
    ...links.filter((l) => /\bicon\b/.test(rel(l))).sort((a, b) => (b.type === 'image/svg+xml' ? 1 : 0) - (a.type === 'image/svg+xml' ? 1 : 0) || size(b) - size(a)).map((l) => abs(l.href)),
    abs('/favicon.ico'),
  ].filter((u): u is string => Boolean(u) && /^https?:/i.test(u!));
  let logo: string | undefined;
  for (const u of [...new Set(candidates)].slice(0, 6)) { logo = await getImage(u, f); if (logo) break; }

  // Colors: the page's own styles plus up to three of its stylesheets.
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n') + [...html.matchAll(/style="([^"]*)"/gi)].map((m) => m[1]).join(';');
  const sheets = links.filter((l) => rel(l).includes('stylesheet')).map((l) => abs(l.href)).filter((u): u is string => Boolean(u)).slice(0, 3);
  for (const s of sheets) { try { css += '\n' + (await getText(s, f, 800_000)); } catch {} }
  const colors = pickColors(css, meta('theme-color'));

  return cleanBrand({ name, logo, ...colors, source: base.href });
}
