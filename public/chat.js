import { html, useEffect, useRef, useState } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { Approval, Icon, TeamUp, Working } from './cards.js';
import { markdown } from './markdown.js';
import { Jelly } from './jelly.js';

/** Groups consecutive steps into one collapsible "Working" card. */
function group(items) {
  const out = [];
  for (const it of items) {
    if (it.type === 'step') {
      const last = out[out.length - 1];
      if (last?.type === 'steps') last.steps.push(it.label);
      else out.push({ type: 'steps', steps: [it.label] });
    } else out.push(it);
  }
  return out;
}

function Activity({ items, brainName, look }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setSecs(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const last = [...items].reverse().find((x) => x.type === 'step');
  const waiting = items.length && items[items.length - 1].type === 'approval' && items[items.length - 1].allowed === undefined;
  const what = waiting ? 'waiting for your approval' : last ? last.label : 'thinking';
  return html`<div class="typing" role="status"><${Jelly} look=${look} size=${28} live=${true} busy=${true} />
    <span><strong>${brainName}</strong> is working · ${what}</span><span class="secs">${secs}s</span></div>`;
}

/** Copy button on a ``` card (markdown.js draws it): copies the card's text, then says so for 2s. */
function copyFromCard(e) {
  const link = e.target.closest?.('.file-link');
  if (link) {
    e.preventDefault();
    fetch('/api/open-file', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: link.dataset.path }) })
      .then((r) => r.json()).then((r) => { if (r.error) link.title = r.error; else { link.classList.add('opened'); setTimeout(() => link.classList.remove('opened'), 1500); } });
    return;
  }
  const btn = e.target.closest?.('.copybtn');
  if (!btn) return;
  const text = btn.closest('.copyblock')?.querySelector('pre')?.textContent ?? '';
  navigator.clipboard.writeText(text).then(
    () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy'; }, 2000); },
    () => { btn.textContent = 'Copy failed'; },
  );
}

export function Thread({ items, busy, brainName, brain, onDecide }) {
  const end = useRef(null);
  // Follow new messages only while the person is at the bottom; scrolling up stays put.
  const atBottomRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const prevLen = useRef(0);
  useEffect(() => {
    const fresh = prevLen.current === 0 || items.length < prevLen.current || items[items.length - 1]?.type === 'user';
    prevLen.current = items.length;
    if (fresh || atBottomRef.current) { end.current?.scrollIntoView({ block: 'end' }); atBottomRef.current = true; setAtBottom(true); }
  }, [items.length, busy]);
  const onScroll = (e) => { const el = e.currentTarget; const at = el.scrollHeight - el.scrollTop - el.clientHeight < 80; atBottomRef.current = at; setAtBottom(at); };
  const jump = () => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); atBottomRef.current = true; setAtBottom(true); };
  if (!items.length && !busy) {
    return html`<div class="thread"><div class="empty">
      <div class="hero"><${Jelly} look=${brain?.avatar} size=${150} live=${true} label=${brainName} />
      <h2>Ask ${brainName}</h2>${brain?.role ? html`<div class="role">${brain.role}</div>` : null}</div>
      <p>Ask in plain words. Paste a screenshot, drop a file, or type @ to bring in a brain.</p>
    </div></div>`;
  }
  const grouped = group(items);
  return html`<div class="thread" aria-live="polite" onScroll=${onScroll}><div class="thread-inner">
    ${grouped.map((it) => {
      if (it.type === 'user') return html`<div class="msg user">
        ${it.previews?.length ? html`<div class="thumbs">${it.previews.map((src) => html`<img src=${src} alt="Pasted image" />`)}</div>` : null}
        ${!it.previews?.length && it.images ? html`<div class="img-count">${it.images} image${it.images > 1 ? 's' : ''}</div>` : null}
        ${it.text}</div>`;
      if (it.type === 'note') return html`<div class="msg note">${it.text}</div>`;
      if (it.type === 'text') return html`<div class="msg brain md" onClick=${copyFromCard} dangerouslySetInnerHTML=${{ __html: markdown(it.text) }}></div>`;
      if (it.type === 'steps') return html`<${Working} steps=${it.steps} live=${busy && it === grouped[grouped.length - 1]} />`;
      if (it.type === 'teamup') return html`<${TeamUp} item=${it} />`;
      if (it.type === 'approval') return html`<${Approval} item=${it} onDecide=${onDecide} />`;
      if (it.type === 'error') return html`<div class="msg error" role="alert">${it.message}</div>`;
      return null;
    })}
    ${busy ? html`<${Activity} items=${items} brainName=${brainName} look=${brain?.avatar} />` : null}
    <div ref=${end}></div>
  </div>${atBottom ? null : html`<button class="jump-bottom" onClick=${jump}>↓ Latest${busy ? ' (still working)' : ''}</button>`}</div>`;
}

export function Composer({ brains, brainId, brainName, busy, onSend, onStop, draft, queued = [], onUnqueue }) {
  const [text, setText] = useState('');
  const [drag, setDrag] = useState(false);
  const [pick, setPick] = useState(null);
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [fileNote, setFileNote] = useState('');
  const input = useRef(null);
  const fileInput = useRef(null);
  // A draft handed in from outside (for example a checkpoint's "Something else") fills the box and puts the cursor at the end.
  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    requestAnimationFrame(() => { const el = input.current; if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; } });
  }, [draft]);
  // The box grows with the text up to half the window, then scrolls; it shrinks back after sending.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight + 2, innerHeight * 0.5) + 'px';
  }, [text]);
  const others = brains.filter((b) => b.id !== brainId);
  const tag = (b) => (b.alias ? b.alias.replace(/\s+/g, '') : b.id);
  const matches = pick === null ? [] : others.filter((b) => b.kind !== 'project' && [b.id, b.name, b.alias ?? ''].some((v) => v.toLowerCase().includes(pick)));

  function change(e) {
    const v = e.target.value;
    setText(v);
    const m = v.slice(0, e.target.selectionStart).match(/(^|\s)@([\w-]*)$/);
    setPick(m ? m[2].toLowerCase() : null);
  }
  function choose(b) {
    setText(text.replace(/(^|\s)@([\w-]*)$/, `$1@${tag(b)} `));
    setPick(null);
    input.current?.focus();
  }
  function addImages(files) {
    for (const f of files) {
      if (!/^image\/(png|jpeg|gif|webp)$/.test(f.type) || f.size > 5 * 1024 * 1024) continue;
      const reader = new FileReader();
      reader.onload = () => setImages((xs) => (xs.length >= 5 ? xs : [...xs, { url: reader.result, mediaType: f.type, data: String(reader.result).split(',')[1] }]));
      reader.readAsDataURL(f);
    }
  }
  function addFiles(list) {
    const next = [...files];
    let note = '';
    for (const f of list) {
      if (f.size > 50 * 1024 * 1024) { note = `${f.name} is over 50 MB.`; continue; }
      if (next.length >= 10) { note = 'Up to 10 files at a time.'; break; }
      if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f);
    }
    setFiles(next);
    setFileNote(note);
  }
  function paste(e) {
    const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); addImages(files); }
  }
  function send() {
    if (!text.trim() && !images.length && !files.length) return;
    onSend(text.trim(), images, files);
    setText('');
    setImages([]);
    setFiles([]);
    setFileNote('');
  }
  function key(e) {
    if (matches.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); choose(matches[0]); return; }
    if (e.key === 'Escape') setPick(null);
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }
  function drop(e) {
    e.preventDefault();
    setDrag(false);
    const files = [...(e.dataTransfer?.files ?? [])];
    const pics = files.filter((f) => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    if (pics.length === files.length && pics.length) addImages(pics);
    else if (files.length) addFiles(files);
  }

  return html`<div class="composer">
    <div class=${'composer-box' + (drag ? ' drag' : '')}
      onDragOver=${(e) => { e.preventDefault(); setDrag(true); }} onDragLeave=${() => setDrag(false)} onDrop=${drop}>
      ${matches.length ? html`<div class="mentions" role="listbox">${matches.map((b, i) => html`<button class=${i === 0 ? 'on' : ''} onClick=${() => choose(b)}>@${tag(b)}${b.role ? ` · ${b.role}` : ''}</button>`)}</div>` : null}
      ${queued.length ? html`<div class="queued" aria-label="Queued messages">${queued.map((q) => html`<div class="queued-item"><span class="queued-tag">Queued</span><span class="queued-text">${q.text || (q.files?.length ? `${q.files.length} file(s)` : `${q.images.length} image(s)`)}</span>
        <button aria-label="Remove queued message" onClick=${() => onUnqueue?.(q)}><${Icon} name="x" /></button></div>`)}</div>` : null}
      ${images.length ? html`<div class="thumbs">${images.map((im, i) => html`<div class="thumb"><img src=${im.url} alt="Pasted image" />
        <button aria-label="Remove image" onClick=${() => setImages(images.filter((_, j) => j !== i))}><${Icon} name="x" /></button></div>`)}</div>` : null}
      ${files.length ? html`<div class="file-chips" aria-label="Attached files">${files.map((f, i) => html`<span class="file-chip" title=${f.name}><${Icon} name="paperclip" /><span class="file-chip-name">${f.name}</span>
        <button aria-label=${'Remove ' + f.name} onClick=${() => setFiles(files.filter((_, j) => j !== i))}><${Icon} name="x" /></button></span>`)}</div>` : null}
      ${fileNote ? html`<div class="file-note">${fileNote}</div>` : null}
      <textarea ref=${input} onPaste=${paste} rows="2" aria-label=${'Message ' + brainName} placeholder=${busy ? `${brainName} is working. Type anyway: it sends when ${brainName} is done.` : `Message ${brainName}. Paste a screenshot, or type @ to bring in a brain.`}
        value=${text} onInput=${change} onKeyDown=${key}></textarea>
      <div class="row">
        <button class="btn ghost sm" aria-label="Attach files" onClick=${() => fileInput.current?.click()}><${Icon} name="paperclip" /></button>
        <input ref=${fileInput} type="file" multiple hidden onChange=${(e) => { if (e.target.files.length) addFiles([...e.target.files]); e.target.value = ''; }} />
        <span class="hint">${busy ? 'Enter to queue. It sends when the brain is done.' : 'Enter to send, Shift+Enter for a new line'}</span>
        ${busy && onStop ? html`<button class="btn sm stop-btn" onClick=${onStop} title=${'Stop ' + brainName}><${Icon} name="x" /> Stop</button>` : null}
        <button class="btn primary sm" disabled=${!text.trim() && !images.length && !files.length} onClick=${send}><${Icon} name="send" /> ${busy ? 'Queue' : 'Send'}</button>
      </div>
    </div>
  </div>`;
}
