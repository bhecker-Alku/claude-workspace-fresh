import { html, useEffect, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { BrainAccess } from './connections.js';
import { Icon } from './cards.js';
import { COLORS, EYES, Jelly, MOUTHS, PACKS, resolvePack, STYLES, THEMES } from './jelly.js';

export const nameOf = (b) => b.alias || b.name;
const groupOf = (b) => b.group || (b.kind === 'project' ? 'Projects' : 'Brains');
const subOf = (b) => (b.busy ? 'Working…' : b.role || b.lastTitle || (b.kind === 'project' ? 'Project' : b.name));

/** A brain in the sidebar. Drop another brain on it to place that one just above or below it. */
function Row({ b, active, onBrain, onEdit, onPlace }) {
  const [pos, setPos] = useState(null); // 'before' | 'after' while a brain hovers over this row
  const where = (e) => { const r = e.currentTarget.getBoundingClientRect(); return e.clientY - r.top > r.height / 2 ? 'after' : 'before'; };
  return html`<div class=${'bot' + (active ? ' active' : '') + (pos ? ' drop-' + pos : '')} draggable="true"
      onDragStart=${(e) => { e.dataTransfer.setData('text/x-brain', b.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver=${(e) => { if (!e.dataTransfer.types.includes('text/x-brain')) return; e.preventDefault(); const p = where(e); if (p !== pos) setPos(p); }}
      onDragLeave=${() => setPos(null)}
      onDrop=${(e) => {
        const id = e.dataTransfer.getData('text/x-brain');
        const p = where(e);
        setPos(null);
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        if (id !== b.id) onPlace(id, b.id, p === 'after');
      }}>
    <button class="bot-main" onClick=${() => onBrain(b.id)} title=${b.blurb || b.path}>
      <${Jelly} look=${b.avatar} size=${30} />
      <span class="bot-text">
        <span class="bot-name">${nameOf(b)}${b.busy
          ? html`<span class="bot-status working" aria-label="Working"></span>`
          : b.done ? html`<span class="bot-status done" aria-label="Finished">✓</span>` : null}</span>
        <span class="bot-sub">${subOf(b)}</span>
      </span>
    </button>
    <button class="bot-edit" aria-label=${'Edit ' + nameOf(b)} title="Edit name and look" onClick=${() => onEdit(b)}><${Icon} name="pencil" /></button>
  </div>`;
}

/** A sidebar section. Saved groups can be renamed and removed; every section takes dropped brains. */
function Group({ name, saved, items, brainId, onBrain, onEdit, onMove, onPlace, onRename, onDelete }) {
  const [mode, setMode] = useState(null);
  // Collapsed state is remembered per group on this computer. The open brain stays visible in a collapsed group.
  const key = 'workspace.collapsed.' + name;
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  const toggle = () => { const v = !collapsed; setCollapsed(v); try { localStorage.setItem(key, v ? '1' : '0'); } catch { /* private mode */ } };
  const shown = collapsed ? items.filter((b) => b.id === brainId) : items;
  const [over, setOver] = useState(false);
  const [text, setText] = useState(name);
  const drop = (e) => {
    e.preventDefault();
    setOver(false);
    const id = e.dataTransfer.getData('text/x-brain');
    if (id) onMove(id, saved ? name : '');
  };
  return html`<section class=${'group' + (over ? ' over' : '')}
      onDragOver=${(e) => { if (e.dataTransfer.types.includes('text/x-brain')) { e.preventDefault(); setOver(true); } }}
      onDragLeave=${() => setOver(false)} onDrop=${drop}>
    ${mode === 'rename'
      ? html`<form class="group-head" onSubmit=${(e) => { e.preventDefault(); setMode(null); if (text.trim() && text.trim() !== name) onRename(name, text.trim()); }}>
          <input class="group-input" value=${text} maxlength="40" autofocus aria-label="Group name" onInput=${(e) => setText(e.target.value)}
            onBlur=${() => setMode(null)} onKeyDown=${(e) => e.key === 'Escape' && setMode(null)} />
        </form>`
      : mode === 'delete'
        ? html`<div class="group-head confirm">Remove "${name}"? <button class="link" onClick=${() => { setMode(null); onDelete(name); }}>Remove</button>
            <button class="link" onClick=${() => setMode(null)}>Keep</button></div>`
        : html`<div class="group-head"><button class="group-toggle eyebrow" aria-expanded=${!collapsed} title=${collapsed ? 'Show this group' : 'Hide this group'} onClick=${toggle}>
            <span class="chev" aria-hidden="true">${collapsed ? '▸' : '▾'}</span>${name}
            ${collapsed ? html`<span class="group-count">${items.length}</span>${items.some((b) => b.busy) ? html`<span class="chat-mark working" aria-label="Working"></span>` : null}` : null}</button>
            ${saved ? html`<button class="group-tool" aria-label=${'Rename ' + name} title="Rename group" onClick=${() => { setText(name); setMode('rename'); }}><${Icon} name="pencil" /></button>
              <button class="group-tool" aria-label=${'Remove ' + name} title="Remove group (its brains move back to Brains)" onClick=${() => setMode('delete')}><${Icon} name="x" /></button>` : null}
          </div>`}
    <div class="nav">
      ${shown.map((b) => html`<${Row} b=${b} active=${b.id === brainId} onBrain=${onBrain} onEdit=${onEdit}
        onPlace=${(id, targetId, after) => { setOver(false); onPlace(id, targetId, after, saved ? name : ''); }} />`)}
      ${items.length === 0 && !collapsed ? html`<div class="drop-hint">Drag a brain here</div>` : null}
    </div>
  </section>`;
}

function NewGroup({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open) return html`<button class="mini" onClick=${() => setOpen(true)}><${Icon} name="plus" /> Group</button>`;
  return html`<form class="group-head" onSubmit=${(e) => { e.preventDefault(); if (text.trim()) onAdd(text.trim()); setText(''); setOpen(false); }}>
    <input class="group-input" value=${text} maxlength="40" autofocus placeholder="Group name, then Enter" aria-label="New group name"
      onInput=${(e) => setText(e.target.value)} onBlur=${() => setOpen(false)} onKeyDown=${(e) => e.key === 'Escape' && setOpen(false)} />
  </form>`;
}

function Recent({ convs, convId, onConv, onDeleteConv, onClear, onNew }) {
  const [confirm, setConfirm] = useState(false);
  return html`<div class="group-head recent-head"><span class="eyebrow">Chats</span>
      <button class="group-tool always" aria-label="New chat" title="New chat" onClick=${onNew}><${Icon} name="plus" /></button>
      ${convs.length ? (confirm
        ? html`<span class="confirm">Clear all? <button class="link" onClick=${() => { setConfirm(false); onClear(); }}>Clear</button> <button class="link" onClick=${() => setConfirm(false)}>Keep</button></span>`
        : html`<button class="link clear" onClick=${() => setConfirm(true)}>Clear all</button>`) : null}
    </div>
    <div class="nav">
      ${convs.map((c) => html`<div class=${'chat-row' + (c.id === convId ? ' active' : '')}>
        <button class="nav-item" onClick=${() => onConv(c.id)} title=${c.title}>
          <span class=${'label' + (c.unread ? ' unread' : '')}>${c.title}</span>
          ${c.running
            ? html`<span class="chat-mark working" aria-label="Working"></span>`
            : c.unread ? html`<span class="chat-mark new" aria-label="New reply"></span>` : null}
        </button>
        <button class="group-tool" aria-label=${'Delete chat ' + c.title} title="Delete this chat" onClick=${() => onDeleteConv(c.id)}><${Icon} name="trash" /></button>
      </div>`)}
    </div>`;
}

/** Bottom of the sidebar: who is signed in. Click it for the account menu. */
function AccountMenu({ account, onMe, onApps, onBrand }) {
  const [open, setOpen] = useState(false);
  const who = String(account || 'Signed in');
  return html`<div class="account-wrap">
    ${open ? html`<div class="account-menu" role="menu" onMouseLeave=${() => setOpen(false)}>
      <button role="menuitem" onClick=${() => { setOpen(false); onMe(); }}><${Icon} name="pencil" /> About you</button>
      <button role="menuitem" onClick=${() => { setOpen(false); onApps(); }}><${Icon} name="apps" /> Connect apps</button>
      <button role="menuitem" onClick=${() => { setOpen(false); onBrand(); }}><${Icon} name="pencil" /> Branding</button>
      <a role="menuitem" href="https://claude.ai/settings/connectors" target="_blank" rel="noreferrer" onClick=${() => setOpen(false)}><${Icon} name="sparkle" /> Claude connector settings</a>
    </div>` : null}
    <button class="account" title="Claude subscription in use. Click for the account menu." aria-expanded=${open} onClick=${() => setOpen(!open)}>
      <span class="avatar" aria-hidden="true">${who.charAt(0).toUpperCase()}</span><span class="account-name">${who}</span></button>
  </div>`;
}

export function Sidebar(p) {
  const { logo, brains, groups: savedGroups = [], brainId, convs, convId, account } = p;
  const sections = savedGroups.map((name) => ({ name, saved: true, items: [] }));
  const fallback = { brain: { name: 'Brains', saved: false, items: [] }, project: { name: 'Projects', saved: false, items: [] } };
  for (const b of brains) {
    const s = b.group && sections.find((x) => x.name === b.group);
    if (s) s.items.push(b);
    else fallback[b.kind === 'project' ? 'project' : 'brain'].items.push(b);
  }
  const all = [...sections, fallback.brain, fallback.project].filter((s) => s.saved || s.items.length);
  return html`<nav class="sidebar" aria-label="Brains">
    <div class="brand"><span dangerouslySetInnerHTML=${{ __html: logo }}></span><span>${p.brandName || 'Workspace'}</span></div>
    <div class="bots">
      ${all.map((s) => html`<${Group} key=${s.name} ...${s} brainId=${brainId} onBrain=${p.onBrain} onEdit=${p.onEdit}
        onMove=${p.onMove} onPlace=${p.onPlace} onRename=${p.onRenameGroup} onDelete=${p.onDeleteGroup} />`)}
      ${brains.length === 0
        ? html`<p class="empty-hint">No brains yet. Put your brain folders in the same folder as <strong>claude-workspace</strong> and restart, or add one here.</p>`
        : null}
      <div class="mini-row">
        <button class="mini" onClick=${p.onNewBrain} title="Make a new brain from the template"><${Icon} name="sparkle" /> New brain</button>
        <button class="mini" onClick=${p.onAddBrain}><${Icon} name="plus" /> Brain or project</button>
        <${NewGroup} onAdd=${p.onAddGroup} />
      </div>
      ${brainId
        ? html`<${Recent} convs=${convs} convId=${convId} onConv=${p.onConv} onDeleteConv=${p.onDeleteConv} onClear=${p.onClearConvs} onNew=${p.onNew} />`
        : null}
    </div>
    <div class="account-row">
      <${AccountMenu} account=${account} onMe=${p.onMe} onApps=${p.onApps} onBrand=${p.onBrand} />
      <button class="apps-btn" aria-label="Connect apps" title="Connect apps" onClick=${p.onApps}><${Icon} name="apps" /></button>
      <button class="theme-toggle" aria-label="Switch light and dark" title="Switch light and dark" onClick=${p.onToggleTheme}><${Icon} name="moon" /></button>
    </div>
  </nav>`;
}

const label = (s) => s[0].toUpperCase() + s.slice(1);

/**
 * The look: a theme (Classic or a pack), then only the choices that theme and character really have.
 * Classic: style, color, eyes, mouth. A pack: a character, then eyes and mouth only when there is a choice
 * (a pack with one mouth, or a character with no mouth, shows no mouth row).
 */
function AvatarPicker({ look, setLook, chip }) {
  const theme = PACKS[look.theme] ? look.theme : 'classic';
  const themed = resolvePack(look);
  // Switching theme keeps the classic choices underneath, so going back to Classic restores them.
  const pickTheme = (t) => setLook(t === 'classic' ? { ...look, theme: undefined } : { ...look, theme: t, character: look.theme === t ? look.character : PACKS[t].characters[0].id, packEyes: undefined, packMouth: undefined });
  const sample = (t) => (t === 'classic' ? { ...look, theme: undefined } : { theme: t, character: (look.theme === t && look.character) || PACKS[t].characters[0].id });
  const option = (key, value, current, preview, title) => html`<button type="button" class=${'chip face-chip' + (current === value ? ' on' : '')}
    aria-pressed=${current === value} title=${title} aria-label=${title} onClick=${() => setLook({ ...look, [key]: value })}>${preview}</button>`;

  const themes = html`<div class="field">Theme<div class="theme-tabs" role="radiogroup" aria-label="Avatar theme">${THEMES.map(([t, l]) => html`
    <button type="button" role="radio" aria-checked=${theme === t} class=${'theme-tab' + (theme === t ? ' on' : '')} onClick=${() => pickTheme(t)}>
      <${Jelly} look=${sample(t)} size=${26} /><span>${l}</span></button>`)}</div></div>`;

  if (!themed) {
    return html`${themes}
      <div class="field">Style<div class="chips">${STYLES.map(([v, l]) => chip('style', v, l, l))}</div></div>
      <div class="field">Color<div class="chips">${COLORS.map((c) => chip('color', c, html`<span class="swatch" style=${`background:var(--jelly-${c})`}></span>`, label(c)))}</div></div>
      <div class="field">Eyes<div class="chips">${EYES.map((e) => chip('eyes', e, html`<${Jelly} look=${{ ...look, eyes: e }} size=${34} zoom=${true} />`, label(e), ' face-chip'))}</div></div>
      <div class="field">Mouth<div class="chips">${MOUTHS.map((m) => chip('mouth', m, html`<${Jelly} look=${{ ...look, mouth: m }} size=${34} zoom=${true} />`, label(m), ' face-chip'))}</div></div>`;
  }

  const { pack, character, eyes, mouth } = themed;
  const eyeChoices = Object.entries(pack.eyes);
  const mouthChoices = character.mouth === null ? [] : Object.entries(pack.mouths);
  return html`${themes}
    <div class="field">Character<div class="character-grid">${pack.characters.map((c) => html`
      <button type="button" class=${'character' + (c.id === character.id ? ' on' : '')} aria-pressed=${c.id === character.id}
        onClick=${() => setLook({ ...look, character: c.id, packEyes: undefined, packMouth: undefined })}>
        <${Jelly} look=${{ theme: look.theme, character: c.id }} size=${48} /><span>${c.name}</span></button>`)}</div></div>
    ${eyeChoices.length > 1 ? html`<div class="field">Eyes<div class="chips">${eyeChoices.map(([k, [name]]) =>
      option('packEyes', k, eyes, html`<${Jelly} look=${{ ...look, packEyes: k }} size=${34} zoom=${true} />`, name))}</div></div>` : null}
    ${mouthChoices.length > 1 ? html`<div class="field">Mouth<div class="chips">${mouthChoices.map(([k, [name]]) =>
      option('packMouth', k, mouth, html`<${Jelly} look=${{ ...look, packMouth: k }} size=${34} zoom=${true} />`, name))}</div></div>` : null}`;
}

/** Name, role, group and look, with a live preview. */
const MODEL_CHOICES = [['', 'Default (Claude Code picks)'], ['opus', 'Opus: most capable'], ['sonnet', 'Sonnet: balanced'], ['haiku', 'Haiku: fastest, lightest']];

/** Optional personality traits, off by default. The app tells the brain about the ones switched on. */
const TRAIT_CHOICES = [
  ['rigid', 'Rigid', 'Prefers clear rules, consistency, and structure.', '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/>'],
  ['creative', 'Creative', 'Enjoys exploring new ideas and imaginative solutions.', '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1V16h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3Z"/>'],
  ['skeptic', 'Skeptic', 'Questions assumptions and looks for evidence first.', '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.6-4.6"/><path d="M9.2 9.2a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.8-.9 1.4v.3"/><path d="M11 15h.01"/>'],
];

/** About you: your name (author on documents brains edit for you) and where finished files go. */
export function AboutYou({ onClose }) {
  const [me, setMe] = useState(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { fetch('/api/me').then((r) => r.json()).then(setMe, () => setMe({ name: '', outputFolder: '' })); }, []);
  async function save(e) {
    e.preventDefault();
    await fetch('/api/me', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(me) });
    setSaved(true);
    setTimeout(onClose, 600);
  }
  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <form class="dialog about-you" onSubmit=${save} role="dialog" aria-modal="true" aria-label="About you">
      <header><strong>About you</strong><span class="spacer"></span>
        <button type="button" class="btn ghost sm" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button></header>
      ${me ? html`
        <label class="field">Your name<input value=${me.name} maxlength="80" placeholder="Your full name" autofocus onInput=${(e) => setMe({ ...me, name: e.target.value })} /></label>
        <p class="hint-text">Brains put this name as the author when they edit your Word documents, so your documents stay yours.</p>
        <label class="field">Save finished files to<input value=${me.outputFolder} maxlength="300" placeholder="For example C:\\Users\\you\\Downloads" onInput=${(e) => setMe({ ...me, outputFolder: e.target.value })} /></label>
        <p class="hint-text">Optional. Leave empty and each brain keeps files in its own folder. Brains always link every file they make.</p>` : html`<p>Loading...</p>`}
      <div class="actions"><button type="button" class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" disabled=${!me}>${saved ? 'Saved' : 'Save'}</button></div>
    </form>
  </div>`;
}

export function EditBrain({ brain, onSave, onClose }) {
  const [f, setF] = useState({ alias: brain.alias || '', role: brain.role || '', group: brain.group || '', model: brain.model || '' });
  const [access, setAccess] = useState({ skillsOff: brain.skillsOff || [], appsOff: brain.appsOff || [] });
  const [traits, setTraits] = useState(brain.traits || []);
  const flipTrait = (t) => setTraits(traits.includes(t) ? traits.filter((x) => x !== t) : [...traits, t]);
  const [look, setLook] = useState({ ...brain.avatar });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    const r = await fetch(`/api/brains/${brain.id}/alias`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, avatar: look, ...access, traits }) });
    if (r.ok) onSave();
    else setError((await r.json()).error || 'Could not save.');
  }
  const chip = (key, value, content, title, extra = '') => html`<button type="button" class=${'chip' + extra + (look[key] === value ? ' on' : '')}
    aria-pressed=${look[key] === value} title=${title} onClick=${() => setLook({ ...look, [key]: value })}>${content}</button>`;

  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <form class="dialog edit-brain" onSubmit=${save} role="dialog" aria-modal="true" aria-label=${'Edit ' + nameOf(brain)}>
      <header><strong>Edit ${nameOf(brain)}</strong><span class="spacer"></span>
        <button type="button" class="btn ghost sm" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button></header>
      <div class="edit-grid">
        <div class="edit-side">
        <div class="preview">
          <${Jelly} look=${look} size=${112} live=${true} label=${'Preview of ' + (f.alias || nameOf(brain))} />
          <div class="preview-name">${f.alias || nameOf(brain)}</div>
          <div class="preview-role">${f.role || 'Role'}</div>
        </div>
          <h3 class="personality-title">Personality</h3>
          <div class="traits" role="group" aria-label="Personality">${TRAIT_CHOICES.map(([t, name, what, icon]) => html`
            <label class=${'trait trait-' + t + (traits.includes(t) ? ' on' : '')}>
              <input type="checkbox" checked=${traits.includes(t)} onChange=${() => flipTrait(t)} />
              <span class="trait-icon" aria-hidden="true"><svg viewBox="0 0 24 24" dangerouslySetInnerHTML=${{ __html: icon }}></svg></span>
              <span class="trait-text"><strong>${name}</strong><span>${what}</span></span></label>`)}</div>
          <label class="model-row"><span>Model</span><span class="model-select"><${Icon} name="sparkle" />
            <select value=${f.model} onChange=${set('model')}>${MODEL_CHOICES.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select></span></label>
        </div>
        <div class="edit-fields">
          <label class="field">Name<input value=${f.alias} onInput=${set('alias')} maxlength="40" placeholder="Edgar" autofocus /></label>
          <label class="field">Role<input value=${f.role} onInput=${set('role')} maxlength="40" placeholder="Strategy & Commercial Lead" /></label>
          <${AvatarPicker} look=${look} setLook=${setLook} chip=${chip} />
        </div>
      </div>
      <${BrainAccess} skillsOff=${access.skillsOff} appsOff=${access.appsOff} onChange=${(c) => setAccess({ ...access, ...c })} />
      ${error ? html`<div class="msg error" role="alert">${error}</div>` : null}
      <div class="actions"><button type="button" class="btn" onClick=${onClose}>Cancel</button><button class="btn primary">Save</button></div>
    </form>
  </div>`;
}
