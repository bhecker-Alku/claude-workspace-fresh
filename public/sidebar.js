import { html, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { BrainAccess } from './connections.js';
import { Icon } from './cards.js';
import { COLORS, EYES, Jelly, MOUTHS, STYLES } from './jelly.js';

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
        : html`<div class="group-head"><span class="eyebrow">${name}</span>
            ${saved ? html`<button class="group-tool" aria-label=${'Rename ' + name} title="Rename group" onClick=${() => { setText(name); setMode('rename'); }}><${Icon} name="pencil" /></button>
              <button class="group-tool" aria-label=${'Remove ' + name} title="Remove group (its brains move back to Brains)" onClick=${() => setMode('delete')}><${Icon} name="x" /></button>` : null}
          </div>`}
    <div class="nav">
      ${items.map((b) => html`<${Row} b=${b} active=${b.id === brainId} onBrain=${onBrain} onEdit=${onEdit}
        onPlace=${(id, targetId, after) => { setOver(false); onPlace(id, targetId, after, saved ? name : ''); }} />`)}
      ${items.length === 0 ? html`<div class="drop-hint">Drag a brain here</div>` : null}
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
function AccountMenu({ account, onApps, onBrand }) {
  const [open, setOpen] = useState(false);
  const who = String(account || 'Signed in');
  return html`<div class="account-wrap">
    ${open ? html`<div class="account-menu" role="menu" onMouseLeave=${() => setOpen(false)}>
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
      <${AccountMenu} account=${account} onApps=${p.onApps} onBrand=${p.onBrand} />
      <button class="apps-btn" aria-label="Connect apps" title="Connect apps" onClick=${p.onApps}><${Icon} name="apps" /></button>
      <button class="theme-toggle" aria-label="Switch light and dark" title="Switch light and dark" onClick=${p.onToggleTheme}><${Icon} name="moon" /></button>
    </div>
  </nav>`;
}

const label = (s) => s[0].toUpperCase() + s.slice(1);

/** Name, role, group and look, with a live preview. */
const MODEL_CHOICES = [['', 'Default (Claude Code picks)'], ['opus', 'Opus: most capable'], ['sonnet', 'Sonnet: balanced'], ['haiku', 'Haiku: fastest, lightest']];

export function EditBrain({ brain, onSave, onClose }) {
  const [f, setF] = useState({ alias: brain.alias || '', role: brain.role || '', group: brain.group || '', model: brain.model || '' });
  const [access, setAccess] = useState({ skillsOff: brain.skillsOff || [], appsOff: brain.appsOff || [] });
  const [look, setLook] = useState({ ...brain.avatar });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    const r = await fetch(`/api/brains/${brain.id}/alias`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, avatar: look, ...access }) });
    if (r.ok) onSave();
    else setError((await r.json()).error || 'Could not save.');
  }
  const chip = (key, value, content, title) => html`<button type="button" class=${'chip' + (look[key] === value ? ' on' : '')}
    aria-pressed=${look[key] === value} title=${title} onClick=${() => setLook({ ...look, [key]: value })}>${content}</button>`;

  return html`<div class="overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <form class="dialog edit-brain" onSubmit=${save} role="dialog" aria-modal="true" aria-label=${'Edit ' + nameOf(brain)}>
      <header><strong>Edit ${nameOf(brain)}</strong><span class="spacer"></span>
        <button type="button" class="btn ghost sm" aria-label="Close" onClick=${onClose}><${Icon} name="x" /></button></header>
      <div class="edit-grid">
        <div class="preview">
          <${Jelly} look=${look} size=${150} live=${true} label=${'Preview of ' + (f.alias || nameOf(brain))} />
          <div class="preview-name">${f.alias || nameOf(brain)}</div>
          <div class="preview-role">${f.role || 'Role'}</div>
        </div>
        <div class="edit-fields">
          <label class="field">Name<input value=${f.alias} onInput=${set('alias')} maxlength="40" placeholder="Edgar" autofocus /></label>
          <label class="field">Role<input value=${f.role} onInput=${set('role')} maxlength="40" placeholder="Strategy & Commercial Lead" /></label>
          <label class="field">Model<select value=${f.model} onChange=${set('model')}>${MODEL_CHOICES.map(([v, l]) => html`<option value=${v}>${l}</option>`)}</select></label>
          <div class="field">Style<div class="chips">${STYLES.map(([v, l]) => chip('style', v, l, l))}</div></div>
          <div class="field">Color<div class="chips">${COLORS.map((c) => chip('color', c, html`<span class="swatch" style=${`background:var(--jelly-${c})`}></span>`, label(c)))}</div></div>
          <div class="field">Eyes<div class="chips">${EYES.map((e) => chip('eyes', e, html`<${Jelly} look=${{ ...look, eyes: e }} size=${32} />`, label(e)))}</div></div>
          <div class="field">Mouth<div class="chips">${MOUTHS.map((m) => chip('mouth', m, html`<${Jelly} look=${{ ...look, mouth: m }} size=${32} />`, label(m)))}</div></div>
        </div>
      </div>
      <${BrainAccess} skillsOff=${access.skillsOff} appsOff=${access.appsOff} onChange=${(c) => setAccess({ ...access, ...c })} />
      ${error ? html`<div class="msg error" role="alert">${error}</div>` : null}
      <div class="actions"><button type="button" class="btn" onClick=${onClose}>Cancel</button><button class="btn primary">Save</button></div>
    </form>
  </div>`;
}
