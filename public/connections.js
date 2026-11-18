import { html, useEffect, useRef, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { Icon } from './cards.js';

/** Where Claude keeps the sign-ins for connectors. The app never holds those keys itself. */
const SIGN_IN = 'https://claude.ai/settings/connectors';
const RANK = { connected: 0, 'needs-auth': 1, failed: 2, pending: 3, disabled: 4 };
const COLORS = ['purple', 'teal', 'amber', 'pink', 'blue', 'lime'];
const colorOf = (s) => COLORS[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % COLORS.length];

function subtitle(c) {
  if (!c.enabled) return 'Off for all brains';
  if (c.status === 'connected') return `Connected · ${c.tools} tool${c.tools === 1 ? '' : 's'}`;
  if (c.status === 'needs-auth') return 'Needs sign-in';
  if (c.status === 'failed') return 'Not working' + (c.error ? `: ${c.error}` : '');
  if (c.status === 'pending') return 'Still connecting…';
  return 'Turned off in Claude Code';
}

/** Connect Apps: the outside apps every brain can use, their status, and an on/off switch for each. */
export function ConnectApps({ onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [find, setFind] = useState('');
  const [tab, setTab] = useState('apps');
  const awaiting = useRef(false); // a sign-in tab is open; recheck when the person comes back

  function load(refresh) {
    setBusy(true);
    fetch('/api/connections' + (refresh ? '?refresh=1' : ''))
      .then(async (r) => { const d = await r.json(); if (r.ok) { setData(d); setError(''); } else setError(d.error || 'Could not check connections.'); })
      .catch(() => setError('Could not reach Claude Workspace.'))
      .finally(() => setBusy(false));
  }
  useEffect(() => {
    load(false);
    const back = () => { if (awaiting.current) { awaiting.current = false; load(true); } };
    window.addEventListener('focus', back);
    return () => window.removeEventListener('focus', back);
  }, []);

  async function toggle(c) {
    const enabled = !c.enabled;
    setData((d) => ({ ...d, items: d.items.map((x) => (x.name === c.name ? { ...x, enabled } : x)) }));
    await fetch('/api/connections/toggle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: c.name, enabled }) });
  }

  const items = (data?.items ?? [])
    .filter((c) => c.label.toLowerCase().includes(find.trim().toLowerCase()))
    .sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || a.label.localeCompare(b.label));
  const connected = items.filter((c) => c.status === 'connected');
  const rest = items.filter((c) => c.status !== 'connected');
  const count = (data?.items ?? []).filter((c) => c.status === 'connected' && c.enabled).length;

  const row = (c) => html`<div class=${'app-row' + (c.enabled ? '' : ' off')} key=${c.name}>
    <span class="app-icon" style=${`background:var(--jelly-${colorOf(c.label)})`} aria-hidden="true">${c.label.charAt(0)}</span>
    <span class="app-text"><span class="app-name">${c.label}</span><span class="app-sub" title=${c.error || ''}>${subtitle(c)}</span></span>
    ${c.status === 'needs-auth' && c.scope === 'claudeai'
      ? html`<a class="btn sm" href=${SIGN_IN} target="_blank" rel="noreferrer" onClick=${() => { awaiting.current = true; }}>Connect</a>`
      : c.status === 'needs-auth'
        ? html`<span class="app-hint" title="This one signs in from Claude Code: open a terminal, run claude, then type /mcp">Sign in from Claude Code</span>`
        : c.status === 'failed'
          ? html`<button class="btn sm" onClick=${() => load(true)}>Retry</button>`
          : html`<label class="switch" title=${c.enabled ? 'Brains can use this' : 'Brains cannot use this'}>
              <input type="checkbox" checked=${c.enabled} onChange=${() => toggle(c)} aria-label=${(c.enabled ? 'Turn off ' : 'Turn on ') + c.label} /><span></span></label>`}
  </div>`;

  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="dialog connect-apps" role="dialog" aria-modal="true" aria-label="Connect Apps">
      <header><strong>Connect Apps</strong><span class="spacer"></span>
        ${data ? html`<span class="app-count">${count} connected</span>` : null}
        <button class="btn ghost sm" aria-label="Check again" title="Check again" disabled=${busy} onClick=${() => load(true)}><${Icon} name="refresh" /></button>
        <button class="btn ghost sm" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button></header>
      <div class="tabs" role="tablist">
        <button role="tab" aria-selected=${tab === 'apps'} class=${tab === 'apps' ? 'on' : ''} onClick=${() => setTab('apps')}>Apps</button>
        <button role="tab" aria-selected=${tab === 'skills'} class=${tab === 'skills' ? 'on' : ''} onClick=${() => setTab('skills')}>Skills${data?.skills ? ` (${data.skills.length})` : ''}</button>
      </div>
      <input class="app-search" type="search" placeholder=${tab === 'apps' ? 'Search apps' : 'Search skills'} value=${find} onInput=${(e) => setFind(e.target.value)} aria-label="Search" />
      ${tab === 'skills' ? html`<div class="app-list">
        ${!data ? html`<p class="app-wait">Checking your skills…</p>` : null}
        ${groupSkills(data?.skills ?? [], find).map(({ group, items: list }) => html`<h4 class="app-head">${group} <span class="app-sub">${list.length}</span></h4>
          ${list.map((s) => html`<div class="app-row" key=${s.name}><span class="app-icon" style=${`background:var(--jelly-${colorOf(s.group)})`} aria-hidden="true">${s.label.charAt(0).toUpperCase()}</span>
            <span class="app-text"><span class="app-name">${s.label}</span><span class="app-sub" title=${s.description}>${s.description}</span></span></div>`)}`)}
      </div>` : html`<div class="app-list">
        ${error ? html`<div class="msg error" role="alert">${error}</div>` : null}
        ${!data && !error ? html`<p class="app-wait">Checking your connections…</p>` : null}
        ${connected.length ? html`<h4 class="app-head">Connected</h4>${connected.map(row)}` : null}
        ${rest.length ? html`<h4 class="app-head">Available</h4>${rest.map(row)}` : null}
        ${data && !items.length ? html`<p class="app-wait">No apps match "${find}".</p>` : null}
      </div>`}
      <p class="app-note">Connect opens your Claude settings in a new tab. Sign in there once, then come back; this list updates. Switching an app off here hides it from every brain. To choose skills and apps for one brain, use its pencil (Edit) menu.</p>
    </div>
  </div>`;
}

/** Skill groups in display order: Featured first, then your own, then each plugin by name. */
export function groupSkills(skills, find = '') {
  const f = find.trim().toLowerCase();
  const by = new Map();
  for (const s of skills) {
    if (f && !(s.label + ' ' + s.description + ' ' + s.group).toLowerCase().includes(f)) continue;
    if (!by.has(s.group)) by.set(s.group, []);
    by.get(s.group).push(s);
  }
  const rank = (g) => (g === 'Featured' ? 0 : g === 'Your skills' ? 1 : 2);
  return [...by.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)).map(([group, items]) => ({ group, items: items.sort((x, y) => x.label.localeCompare(y.label)) }));
}

/** In a brain's Edit menu: which skills and apps this brain may use. Everything starts on. */
export function BrainAccess({ skillsOff, appsOff, onChange }) {
  const [data, setData] = useState(null);
  const [find, setFind] = useState('');
  useEffect(() => { fetch('/api/connections').then((r) => r.json()).then(setData).catch(() => setData({ items: [], skills: [] })); }, []);
  if (!data) return html`<p class="app-wait">Loading skills and apps…</p>`;
  const offS = new Set(skillsOff), offA = new Set(appsOff);
  const flip = (list, name) => (list.includes(name) ? list.filter((x) => x !== name) : [...list, name]);
  const apps = (data.items || []).filter((c) => c.status === 'connected' && c.enabled);
  const skills = data.skills || [];
  const groups = groupSkills(skills, find);
  const setGroup = (items, on) => {
    const names = new Set(items.map((s) => s.name));
    onChange({ skillsOff: on ? skillsOff.filter((n) => !names.has(n)) : [...new Set([...skillsOff, ...names])] });
  };
  return html`<div class="brain-access">
    <details>
      <summary><strong>Skills</strong> <span class="app-sub">${skills.length - skills.filter((s) => offS.has(s.name)).length} of ${skills.length} on</span></summary>
      <input class="app-search" type="search" placeholder="Search skills" value=${find} onInput=${(e) => setFind(e.target.value)} aria-label="Search skills" />
      <div class="access-list">${groups.map(({ group, items }) => html`<div class="access-group" key=${group}>
        <div class="access-head"><span>${group}</span>
          <button type="button" class="link" onClick=${() => setGroup(items, true)}>All on</button>
          <button type="button" class="link" onClick=${() => setGroup(items, false)}>All off</button></div>
        ${items.map((s) => html`<label class="access-row" key=${s.name} title=${s.description}>
          <input type="checkbox" checked=${!offS.has(s.name)} onChange=${() => onChange({ skillsOff: flip(skillsOff, s.name) })} />
          <span class="access-text"><span>${s.label}</span><span class="app-sub">${s.description}</span></span></label>`)}
      </div>`)}</div>
    </details>
    <details>
      <summary><strong>Apps</strong> <span class="app-sub">${apps.length - apps.filter((c) => offA.has(c.name)).length} of ${apps.length} on</span></summary>
      <div class="access-list">
        ${apps.length ? apps.map((c) => html`<label class="access-row" key=${c.name}>
          <input type="checkbox" checked=${!offA.has(c.name)} onChange=${() => onChange({ appsOff: flip(appsOff, c.name) })} />
          <span class="access-text"><span>${c.label}</span><span class="app-sub">${c.tools} tools</span></span></label>`)
          : html`<p class="app-wait">No apps connected yet. Use Connect apps at the bottom of the sidebar.</p>`}
      </div>
    </details>
  </div>`;
}
