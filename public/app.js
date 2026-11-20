import { html, render, useEffect, useRef, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { Icon } from './cards.js';
import { EditBrain, Sidebar, nameOf, AboutYou } from './sidebar.js';
import { Jelly } from './jelly.js';
import { Composer, Thread } from './chat.js';
import { Library } from './library.js';
import { GraphView } from './graph.js';
import { CheckpointCard, answerText } from './checkpoint.js';
import { Search } from './search.js';
import { PowerButton, UpdateChip } from './power.js';
import { ContinueChat, FolderBrowser } from './folders.js';
import { ConnectApps } from './connections.js';
import { applyBrand, BrandDialog, logoHtml } from './brand.js';

async function stopBrainRequest(brainId) {
  return fetch(`/api/brains/${brainId}/stop`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
}
const api = (url, body) =>
  fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then(async (r) => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) }));

function SignIn({ logo, reason, onRetry }) {
  return html`<div class="signin"><div class="panel">
    <span dangerouslySetInnerHTML=${{ __html: logo.replace('<svg', '<svg class="logo"') }}></span>
    <h2>Sign in to Claude Code first</h2>
    <p>Claude Workspace uses your own Claude subscription. Open Claude Code once and sign in, then try again.</p>
    ${reason ? html`<p class="msg note">${reason}</p>` : null}
    <button class="btn primary" onClick=${onRetry}>Try again</button>
  </div></div>`;
}

/** After a restart: wait for the old server to go away (or 5 seconds), then reload once the new one answers. */
let reloading = false;
async function reloadWhenBack() {
  if (reloading) return;
  reloading = true;
  const up = () => fetch('/api/brains', { cache: 'no-store' }).then((r) => r.ok, () => false);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 5 && (await up()); i++) await wait(1000);
  for (let i = 0; i < 60; i++) { if (await up()) break; await wait(1000); }
  location.reload();
}

/** Chats with a reply you have not opened yet. Kept across reloads. */
const readUnread = () => { try { return new Set(JSON.parse(localStorage.getItem('workspace-unread') || '[]')); } catch (e) { return new Set(); } };
const saveUnread = (s) => { try { localStorage.setItem('workspace-unread', JSON.stringify([...s])); } catch (e) {} };

const readMe = () => { try { return localStorage.getItem('workspace-me') || ''; } catch (e) { return ''; } };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One quiet line when something in this brain waits on you. Asks your name once. */
function WaitingNote({ me, waiting, onSetMe, onLook, busy = false }) {
  const [name, setName] = useState('');
  if (!me) {
    return html`<form class="waiting" onSubmit=${(e) => { e.preventDefault(); if (name.trim()) onSetMe(name.trim()); }}>
      <span>What name do brains use for you? Then I can tell you what is waiting on you.</span>
      <input class="waiting-input" placeholder="for example sam" value=${name} onInput=${(e) => setName(e.target.value)} />
      <button class="btn sm" type="submit">Save</button>
    </form>`;
  }
  if (!waiting.length) return null;
  const top = waiting[0];
  const kinds = waiting.length === 1 ? top.kind : 'thing';
  const age = top.age != null ? ` (${top.age} days)` : '';
  const more = waiting.length > 1 ? `, oldest${age}: ` : `${age}: `;
  return html`<div class="waiting" role="status">
    <span><strong>${plural(waiting.length, kinds)} waiting on you</strong>${more}${top.title.toLowerCase()}</span>
    <button class="btn sm" disabled=${busy} title=${busy ? 'This brain is working. Try when it is done.' : ''} onClick=${onLook}>Look now</button>
  </div>`;
}

/** The chat last open in each brain, by brain id. */
const lastChats = () => { try { return JSON.parse(localStorage.getItem('workspace-last-chat') || '{}'); } catch (e) { return {}; } };

function App() {
  const [defaultLogo, setLogo] = useState('');
  const [brand, setBrand] = useState({});
  const logo = logoHtml(brand, defaultLogo);
  const useBrand = (b) => { setBrand(b); applyBrand(b); };
  const [session, setSession] = useState(null);
  const [brains, setBrains] = useState([]);
  const [brainId, setBrainId] = useState(null);
  const [convs, setConvs] = useState([]);
  const [convId, setConvId] = useState(null);
  const [items, setItems] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [me, setMe] = useState(readMe());
  const [checkpoints, setCheckpoints] = useState([]);
  const [draft, setDraft] = useState(null);
  // Restart or shut down: { mode: 'restart' | 'shutdown', waiting } while it happens, else null.
  const [leaving, setLeaving] = useState(null);
  const onLeaving = (mode, waiting) => {
    setLeaving({ mode, waiting });
    if (!waiting && mode === 'restart') reloadWhenBack();
  };
  async function leave(mode) {
    const r = await api(`/api/${mode}`, {});
    if (r.status === 404) return alertNote('Claude Workspace needs one Restart to finish updating. Click Restart, then try again.');
    if (!r.ok) return alertNote(mode === 'restart' ? 'Could not restart.' : 'Could not shut down.');
    onLeaving(mode, r.data.waiting);
  }
  // "Update ready" shows only when the server's code changed since it started (or the server is too old to say).
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    const check = () => fetch('/api/health', { cache: 'no-store' })
      .then((r) => (r.status === 404 ? { updateReady: true } : r.ok ? r.json() : null), () => null)
      .then((h) => h && setUpdateReady(Boolean(h.updateReady)));
    check();
    const t = setInterval(check, 30_000);
    window.addEventListener('focus', check);
    return () => { clearInterval(t); window.removeEventListener('focus', check); };
  }, []);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [addNote, setAddNote] = useState('');
  const [dialog, setDialog] = useState(null);
  const convRef = useRef(null);
  convRef.current = convId;

  const brain = brains.find((b) => b.id === brainId);
  // Which conversations have a turn running. Per conversation, so switching brains never locks the box.
  const [workingConvs, setWorkingConvs] = useState(new Set());
  const working = convId !== null && workingConvs.has(convId);
  const setConvWorking = (id, on) => setWorkingConvs((s) => { if (s.has(id) === on) return s; const t = new Set(s); on ? t.add(id) : t.delete(id); return t; });
  // Chats that got a reply while you were looking at something else.
  const [unread, setUnread] = useState(readUnread);
  const markUnread = (id, on) => setUnread((s) => { if (s.has(id) === on) return s; const t = new Set(s); on ? t.add(id) : t.delete(id); saveUnread(t); return t; });
  const busy = Boolean(brain?.busy) || working;
  const [groups, setGroups] = useState([]);
  // Brains that finished while you were elsewhere: a check in the sidebar until you open them.
  const [done, setDone] = useState(new Set());
  const busyBefore = useRef(new Map());
  const brainIdRef = useRef(null);
  brainIdRef.current = brainId;
  const refreshBrains = () => {
    api('/api/groups').then((r) => r.ok && setGroups(r.data));
    return api('/api/brains').then((r) => {
      if (!r.ok) return;
      const finished = r.data.filter((b) => busyBefore.current.get(b.id) && !b.busy).map((b) => b.id);
      busyBefore.current = new Map(r.data.map((b) => [b.id, Boolean(b.busy)]));
      if (finished.length) {
        const away = finished.filter((id) => id !== brainIdRef.current);
        if (away.length) setDone((s) => new Set([...s, ...away]));
      }
      setBrains(r.data);
    });
  };
  const post = (url, body = {}) => api(url, body).then((r) => { refreshBrains(); return r; });
  // Drag a brain onto another: it lands just above or below it (and joins that group), and the order is saved.
  async function placeBrain(id, targetId, after, group) {
    const moved = brains.find((b) => b.id === id);
    if (!moved) return;
    const ids = brains.map((b) => b.id).filter((x) => x !== id);
    const at = ids.indexOf(targetId);
    ids.splice(at < 0 ? ids.length : at + (after ? 1 : 0), 0, id);
    setBrains(ids.map((x) => (x === id ? { ...moved, group } : brains.find((b) => b.id === x))));
    if ((moved.group || '') !== group) await api(`/api/brains/${id}/group`, { group });
    await api('/api/order', { ids });
    refreshBrains();
  }
  async function deleteConv(id) {
    const r = await api(`/api/conversations/${id}/delete`, {});
    if (!r.ok) return alertNote(r.data.error);
    if (id === convId) { setConvId(null); setItems([]); }
    refreshConvs();
    refreshBrains();
  }
  async function clearConvs() {
    const r = await api(`/api/brains/${brainId}/conversations/clear`, {});
    if (!r.ok) return alertNote(r.data.error);
    setConvId(null);
    setItems([]);
    refreshConvs();
    refreshBrains();
  }
  const alertNote = (message) => setItems((xs) => [...xs, { type: 'error', message: message || 'Something went wrong.' }]);
  const refreshConvs = (id = brainId) => id && api(`/api/brains/${id}/conversations`).then((r) => r.ok && setConvs(r.data));
  const checkSession = () => { setSession(null); api('/api/session').then((r) => setSession(r.data)); };

  useEffect(() => {
    fetch('logo.svg').then((r) => r.text()).then(setLogo);
    api('/api/brand').then((r) => r.ok && useBrand(r.data));
    checkSession();
    refreshBrains();
    const es = new EventSource('/api/events');
    es.onmessage = (m) => {
      const e = JSON.parse(m.data);
      if (e.type === 'restarting') { onLeaving(e.mode || 'restart', e.waiting); return; }
      if (e.convId && ['step', 'text', 'approval', 'teamup'].includes(e.type)) setConvWorking(e.convId, true);
      if (e.type === 'done' || e.type === 'error') {
        refreshBrains(); refreshConvs(); window.dispatchEvent(new Event('workspace:usage'));
        if (e.convId) { setConvWorking(e.convId, false); if (e.convId !== convRef.current) markUnread(e.convId, true); }
      }
      if (e.convId !== convRef.current) return;
      if (e.type === 'approval-resolved') {
        setItems((xs) => xs.map((x) => (x.type === 'approval' && x.id === e.id ? { ...x, allowed: e.allowed } : x)));
      } else if (e.type !== 'done') setItems((xs) => [...xs, e]);
    };
    return () => es.close();
  }, []);

  useEffect(() => { refreshConvs(); }, [brainId]);

  async function openBrain(id) {
    setBrainId(id);
    setDone((s) => { const t = new Set(s); t.delete(id); return t; });
    setConvId(null);
    setItems([]);
    loadWaiting(id);
    // Pick up where you left off: the chat you last had open in this brain, else its newest chat.
    const r = await api(`/api/brains/${id}/conversations`);
    if (!r.ok || !r.data.length || brainIdRef.current !== id || convRef.current) return;
    const last = lastChats()[id];
    openConv((r.data.find((c) => c.id === last) ?? r.data[0]).id);
  }
  // Remember the open chat per brain, so clicking the brain again reopens it.
  useEffect(() => {
    if (!brainId || !convId) return;
    try { localStorage.setItem('workspace-last-chat', JSON.stringify({ ...lastChats(), [brainId]: convId })); } catch (e) {}
  }, [brainId, convId]);
  function loadWaiting(id = brainId, who = me) {
    setWaiting([]);
    setCheckpoints([]);
    if (!id || !who) return;
    const q = `who=${encodeURIComponent(who)}`;
    // Checkpoints get their own cards, so the waiting line only counts the rest.
    api(`/api/brains/${id}/status?${q}`).then((r) => r.ok && setWaiting((r.data.waiting || []).filter((w) => w.kind !== 'checkpoint')));
    api(`/api/brains/${id}/checkpoints?${q}`).then((r) => r.ok && setCheckpoints(r.data.checkpoints || []));
  }
  function answerCheckpoint(item, answer) {
    setCheckpoints((xs) => xs.filter((x) => x !== item));
    if (answer) send(answerText(item, answer));
    else setDraft({ text: answerText(item, null) });
  }
  function saveMe(name) {
    try { localStorage.setItem('workspace-me', name); } catch (e) {}
    setMe(name);
    loadWaiting(brainId, name);
  }
  async function openConv(id) {
    setConvId(id);
    markUnread(id, false);
    const r = await api(`/api/conversations/${id}/transcript`);
    const loaded = [];
    for (const x of r.ok ? r.data : []) {
      if (x.type !== 'approval-resolved') loaded.push(x);
      else {
        const card = loaded.find((y) => y.type === 'approval' && y.id === x.id);
        if (card) card.allowed = x.allowed;
      }
    }
    setItems(loaded);
  }
  async function ensureConv(title) {
    if (convId) return convId;
    const r = await api(`/api/brains/${brainId}/conversations`, { title: title.slice(0, 60) });
    setConvId(r.data.id);
    convRef.current = r.data.id;
    refreshConvs();
    return r.data.id;
  }
  // Messages typed while this chat is busy wait here and go out, oldest first, once it is free.
  const [queue, setQueue] = useState([]);
  const here = `${brainId}|${convId}`;
  const queuedHere = queue.filter((q) => q.at === here);
  function submit(text, images = [], files = []) {
    if (busy) setQueue((qs) => [...qs, { at: here, text, images, files, n: Date.now() + Math.random() }]);
    else send(text, images, files);
  }
  const draining = useRef(false); // one queued message in flight at a time
  const [drained, setDrained] = useState(0);
  useEffect(() => {
    if (busy || draining.current || !queuedHere.length) return;
    const next = queuedHere[0];
    draining.current = true;
    setQueue((qs) => qs.filter((q) => q !== next));
    send(next.text, next.images, next.files).finally(() => { draining.current = false; setDrained((d) => d + 1); });
  }, [busy, here, queue, drained]);
  async function send(text, images = [], files = []) {
    const id = await ensureConv(text || 'Files');
    let full = text;
    if (files.length) {
      const form = new FormData();
      form.append('send', 'no');
      for (const f of files) form.append('files', f);
      const u = await fetch(`/api/conversations/${id}/files`, { method: 'POST', body: form }).then(async (x) => ({ ok: x.ok, data: await x.json().catch(() => ({})) }));
      if (!u.ok) { setItems((xs) => [...xs, { type: 'error', message: u.data.error || 'Could not upload the files.' }]); return; }
      full = text ? `${text}\n\n${u.data.note}` : u.data.note;
    }
    const shown = files.length ? `${text}${text ? '\n\n' : ''}📎 ${files.map((f) => f.name).join(', ')}` : text;
    setItems((xs) => [...xs, { type: 'user', text: shown, previews: images.map((i) => i.url) }]);
    setConvWorking(id, true);
    const r = await api(`/api/conversations/${id}/messages`, { text: full, images: images.map(({ mediaType, data }) => ({ mediaType, data })) });
    if (!r.ok) { setConvWorking(id, false); setItems((xs) => [...xs, { type: 'error', message: r.data.error || 'Could not send.' }]); }
    refreshBrains();
  }
  async function upload(fileList) {
    const id = await ensureConv('Files');
    const form = new FormData();
    for (const f of fileList) form.append('files', f);
    const r = await fetch(`/api/conversations/${id}/files`, { method: 'POST', body: form }).then(async (x) => ({ ok: x.ok, data: await x.json() }));
    if (r.ok) setItems((xs) => [...xs, { type: 'user', text: `Added ${r.data.saved.length} file(s) to the inbox.` }]);
    else setItems((xs) => [...xs, { type: 'error', message: r.data.error }]);
    refreshBrains();
  }
  async function newBrainFromTemplate() {
    const name = prompt('Name for the new brain (for example "Grant Writer"):');
    if (!name || !name.trim()) return;
    const r = await api('/api/brains/new', { name: name.trim() });
    if (!r.ok) return alert(r.data.error || 'Could not make the brain.');
    await refreshBrains();
    openBrain(r.data.id);
  }
  function addBrain() {
    setAddNote('');
    setDialog('folders');
  }
  async function added(b) {
    setDialog(null);
    await refreshBrains();
    openBrain(b.id);
  }
  async function continueChat(sid) {
    setDialog(null);
    const r = await api(`/api/brains/${brainId}/claude-sessions/${sid}/continue`, {});
    if (!r.ok) return setItems([{ type: 'error', message: r.data.error || 'Could not open that chat.' }]);
    await refreshConvs();
    openConv(r.data.id);
  }
  const decide = (id, allowed) => api(`/api/approvals/${id}`, { allowed });
  function toggleTheme() {
    const dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('workspace-theme', dark ? 'dark' : 'light'); } catch (e) {}
  }

  if (leaving?.mode === 'shutdown' && !leaving.waiting) return html`<div class="signin"><div class="panel">
    <h2>Claude Workspace is off</h2>
    <p>To start it again, double-click <strong>Start Claude Workspace</strong>, or run <code>npm start</code> in its folder. You can close this tab.</p>
  </div></div>`;
  if (!session) return html`<div class="signin"><div class="loader"></div></div>`;
  if (!session.ok) return html`<${SignIn} logo=${logo} reason=${session.reason} onRetry=${checkSession} />`;

  return html`<div class=${'shell' + (showLibrary && brain ? ' with-library' : '')}>
    <${Sidebar} logo=${logo} brains=${brains.map((b) => (done.has(b.id) ? { ...b, done: true } : b))} brainId=${brainId} convs=${convs.map((c) => ({ ...c, running: workingConvs.has(c.id), unread: unread.has(c.id) }))} convId=${convId} account=${session.account} onApps=${() => setDialog('apps')} onMe=${() => setDialog('me')} onBrand=${() => setDialog('brand')} brandName=${brand.name}
      onBrain=${openBrain} onConv=${openConv} onNew=${() => { setConvId(null); setItems([]); }} onAddBrain=${addBrain} onNewBrain=${newBrainFromTemplate} onEdit=${(b) => setDialog({ edit: b })}
      groups=${groups} onMove=${(id, group) => post(`/api/brains/${id}/group`, { group })} onPlace=${placeBrain}
      onAddGroup=${(name) => post('/api/groups', { name })} onRenameGroup=${(from, to) => post('/api/groups/rename', { from, to })}
      onDeleteGroup=${(name) => post('/api/groups/delete', { name })} onDeleteConv=${deleteConv} onClearConvs=${clearConvs}
      onToggleTheme=${toggleTheme} />
    <main class="main">
      ${leaving ? html`<div class="restart-note" role="status">${leaving.mode === 'shutdown'
        ? (leaving.waiting ? 'Shutting down once the brains finish.' : 'Shutting down.')
        : (leaving.waiting ? 'Restarting once the brains finish.' : 'Restarting, back in a few seconds.')}</div>` : null}
      ${brain
        ? html`<div class="topbar">
            <${Jelly} look=${brain.avatar} size=${40} />
            <div><h1>${nameOf(brain)}${brain.role ? html` <span class="bot-role">· ${brain.role}</span>` : null}</h1><div class="sub">${brain.kind === 'project' ? brain.path : `${brain.profile} · owner ${brain.owner.replace('human:', '')}`}</div></div>
            <span class="spacer"></span>
            <${Search} brainId=${brainId} onOpen=${(h) => api(`/api/brains/${h.brainId}/library/open`, { path: h.path })} />
            <button class="btn sm" onClick=${() => setDialog('continue')}>Continue a Claude Code chat</button>
            ${updateReady ? html`<${UpdateChip} busy=${leaving !== null} onRestart=${() => leave('restart')} />` : null}
            ${brain.kind !== 'project' ? html`<button class="btn sm" aria-pressed=${showGraph} onClick=${() => setShowGraph(!showGraph)}>${showGraph ? 'Back to chat' : 'Graph'}</button>` : null}
            <button class="btn sm" aria-pressed=${showLibrary} onClick=${() => setShowLibrary(!showLibrary)}><${Icon} name="library" /> Library</button>
            <${PowerButton} onFire=${() => leave('shutdown')} busy=${leaving?.mode === 'shutdown'} />
          </div>
          ${showGraph && brain.kind !== 'project'
            ? html`<${GraphView} brainId=${brainId} onOpen=${(p) => api(`/api/brains/${brainId}/library/open`, { path: p })} />`
            : html`
          ${brain.kind !== 'project' && items.length === 0 && me
            ? html`<${CheckpointCard} items=${checkpoints} onAnswer=${answerCheckpoint} busy=${Boolean(brain?.busy)} />`
            : null}
          ${brain.kind !== 'project' && items.length === 0
            ? html`<${WaitingNote} me=${me} waiting=${waiting} onSetMe=${saveMe}
                busy=${Boolean(brain?.busy)} onLook=${() => { setWaiting([]); send('What is waiting on me in this brain? Take me through it, oldest first.'); }} />`
            : null}
          <${Thread} items=${items} busy=${working || (Boolean(brain?.busy) && convId !== null)} brainName=${nameOf(brain)} brain=${brain} onDecide=${decide} />
          <${Composer} brains=${brains} brainId=${brainId} brainName=${nameOf(brain)} busy=${busy} onSend=${submit} onStop=${async () => { if (!confirm(`Stop ${nameOf(brain)}? It will drop what it is doing on this request.`)) return; setQueue((qs) => qs.filter((q) => q.at !== here)); await stopBrainRequest(brainId); refreshBrains(); }} queued=${queuedHere} onUnqueue=${(q) => setQueue((qs) => qs.filter((x) => x !== q))} draft=${draft} />`}`
        : html`<div class="thread"><div class="empty">
            <${Icon} name="brain" />
            <h2>Welcome to your Workspace</h2>
            <p>Pick a brain on the left to start. Brains can bring each other in when a question needs more than one.</p>
          </div></div>`}
    </main>
    ${showLibrary && brain ? html`<${Library} brainId=${brainId} onClose=${() => setShowLibrary(false)} />` : null}
    ${dialog?.edit ? html`<${EditBrain} brain=${dialog.edit} onSave=${() => { setDialog(null); refreshBrains(); }} onClose=${() => setDialog(null)} />` : null}
    ${dialog === 'brand' ? html`<${BrandDialog} brand=${brand} onSaved=${(b) => { useBrand(b); setDialog(null); }} onClose=${() => setDialog(null)} />` : null}
    ${dialog === 'me' ? html`<${AboutYou} onClose=${() => setDialog(null)} />` : null}
    ${dialog === 'apps' ? html`<${ConnectApps} onClose=${() => setDialog(null)} />` : null}
    ${dialog === 'folders' ? html`<${FolderBrowser} onAdd=${added} onClose=${() => setDialog(null)} />` : null}
    ${dialog === 'continue' && brain ? html`<${ContinueChat} brainId=${brainId} onPick=${continueChat} onClose=${() => setDialog(null)} />` : null}
  </div>`;
}

render(html`<${App} />`, document.getElementById('root'));
