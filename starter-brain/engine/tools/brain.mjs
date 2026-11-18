#!/usr/bin/env node
// The brain engine: one file, no installs, Node 18+.
// Keeps the brain's generated files in step with its notes and checks the brain's health.
//
//   node engine/tools/brain.mjs refresh                 index + graph + routes + check (run after any change)
//   node engine/tools/brain.mjs graph | index | routes  rebuild one generated file
//   node engine/tools/brain.mjs check                   health check; exits 1 when something is broken
//   node engine/tools/brain.mjs status --who NAME       what waits on NAME (feedback, checkpoints)
//   node engine/tools/brain.mjs new-domain NAME "what it covers"
//   node engine/tools/brain.mjs new-note DOMAIN SLUG "Title" [type]
//   node engine/tools/brain.mjs run new SLUG "goal" | run step ID "what happened" [--await NAME "question"] | run done ID
//   node engine/tools/brain.mjs evals                   list the test questions in brain/evals
//   node engine/tools/brain.mjs used ID [ID...] --q "question" [--searched]   record which notes answered a question
//   node engine/tools/brain.mjs learn                   what the usage record suggests: hot notes, missing links, missing paths
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BRAIN = path.join(ROOT, 'brain');
const TYPES = ['profile', 'hub', 'fact', 'person', 'organization', 'project', 'term', 'decision', 'risk', 'howto', 'question', 'source', 'deliverable', 'feedback', 'eval', 'note'];
/** Front matter fields that link to other notes, and what the link means. */
const RELATIONS = { people: 'involves', person: 'involves', owner: 'owned-by', decided_by: 'decided-by', organizations: 'with', organization: 'with', projects: 'part-of', project: 'part-of', part_of: 'part-of', decisions: 'decided', risks: 'risk', mitigates: 'mitigates', terms: 'uses-term', related: 'related', supersedes: 'supersedes', replaced_by: 'replaced-by', links: 'related', sources: 'source' };
/** Stock phrases that make writing sound machine-made. The health check flags them. */
const SLOP = /\b(delve|delves|delving|leverag(e|es|ing)|utiliz(e|es|ing)|robust|seamless(ly)?|cutting-edge|game[- ]changer|unlock(s|ing)? the|elevate|empower(s|ing)?|synerg(y|ies)|holistic|tapestry|in today's fast-paced|it's important to note|it is important to note|at the end of the day|in the realm of|navigat(e|ing) the (complex|ever)|ever-evolving|a testament to|i hope this helps|great question|certainly!|as an ai)\b/gi;
/** Fields each type should have, so the registers are complete. Missing ones are warnings. */
const NEEDS = { person: ['role'], project: ['owner'], decision: ['date', 'decided_by'], risk: ['severity', 'owner'], term: [] };
const STATUSES = ['active', 'draft', 'deprecated', 'open', 'applied', 'dismissed'];
const SKIP_DIRS = new Set(['inbox', 'runs', 'registers']);
const GENERATED = new Set(['index.md', 'graph.json', 'routing.md', 'ledger.jsonl']);
const today = () => new Date().toISOString().slice(0, 10);
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// ---- reading notes ----

/** Front matter: simple `key: value` lines and `key: [a, b]` lists between --- fences. */
export function parseNote(text) {
  const meta = {};
  let body = text;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (m) {
    body = text.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!kv) continue;
      let v = kv[2].trim();
      if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      else v = v.replace(/^["']|["']$/g, '');
      meta[kv[1]] = v;
    }
  }
  return { meta, body };
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!(dir === BRAIN && SKIP_DIRS.has(e.name))) walk(p, out); }
    else if (e.name.endsWith('.md') && !(dir === BRAIN && GENERATED.has(e.name))) out.push(p);
  }
  return out;
}

const defaultType = (r) => (r.startsWith('brain/sources/') ? 'source' : r.startsWith('brain/deliverables/') ? 'deliverable' : r.startsWith('brain/feedback/') ? 'feedback' : r.startsWith('brain/evals/') ? 'eval' : path.basename(r) === '_hub.md' ? 'hub' : 'note');

/** Every note in brain/, with what the graph, index and checks need. */
export function loadNotes() {
  return walk(BRAIN).map((file) => {
    const text = readFileSync(file, 'utf8');
    const { meta, body } = parseNote(text);
    const r = rel(file);
    const id = r.replace(/^brain\//, '').replace(/\.md$/, '');
    const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const firstLine = body.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('|') && !l.startsWith('-')) ?? '';
    const parts = id.split('/');
    const domain = meta.domain || (parts[0] === 'notes' && parts.length > 2 ? parts[1] : '');
    const links = new Map(); // target -> kind
    const soft = new Set(); // front matter values may be plain names, not notes yet
    const link = (to, kind, fromMeta = false) => { if (to && !links.has(to)) { links.set(to, kind); if (fromMeta) soft.add(to); } };
    // Typed relations first, so their meaning wins over a plain link to the same note.
    for (const [field, kind] of Object.entries(RELATIONS)) for (const l of [].concat(meta[field] ?? [])) if (l && !/^(none|n\/a|-)$/i.test(String(l))) link(String(l).replace(/^brain\//, '').replace(/\.md$/, '').replace(/^\[\[|\]\]$/g, ''), kind, true);
    // Examples in `code` or ``` blocks are not links.
    const prose = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const w of prose.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) link(w[1].trim(), 'link');
    for (const l of prose.matchAll(/\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g)) if (!/^https?:/i.test(l[1])) link(path.posix.normalize(path.posix.join(path.posix.dirname(id), l[1])).replace(/\.md$/, ''), 'link');
    return {
      id, file, path: r, meta, body, domain,
      type: meta.type || defaultType(r),
      title: meta.title || heading || path.basename(id).replace(/^_/, '').replace(/-/g, ' '),
      description: (meta.description || firstLine).replace(/\s+/g, ' ').slice(0, 240),
      status: meta.status || 'active',
      links: [...links.keys()],
      rels: [...links.entries()].map(([to, kind]) => ({ to, kind, soft: soft.has(to) })),
      mtime: statSync(file).mtimeMs,
    };
  });
}

/** A link can name a note by its id, its file name, or its title. */
function resolver(notes) {
  const byId = new Map(notes.map((n) => [n.id.toLowerCase(), n]));
  const byBase = new Map();
  for (const n of notes) { const b = path.posix.basename(n.id).toLowerCase(); if (!byBase.has(b)) byBase.set(b, n); }
  const byTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n]));
  return (link, from = '') => {
    const k = link.toLowerCase().replace(/\.md$/, '');
    const near = from ? byId.get(path.posix.join(path.posix.dirname(from.toLowerCase()), k)) : undefined;
    return near ?? byId.get(k) ?? byId.get('notes/' + k) ?? byBase.get(path.posix.basename(k)) ?? byTitle.get(k) ?? byBase.get(slugify(k));
  };
}

// ---- generated files ----

/** brain/graph.json: one node per note, an edge per link, and every note joined to its domain hub. */
export function buildGraph(notes = loadNotes()) {
  const find = resolver(notes);
  const hubs = new Map(notes.filter((n) => n.type === 'hub' && n.domain).map((n) => [n.domain, n]));
  const edges = [], seen = new Set();
  const add = (a, b, kind) => { if (!a || !b || a === b) return; const k = [a, b].sort().join('|'); if (!seen.has(k)) { seen.add(k); edges.push({ source: a, target: b, kind }); } };
  const usage = readUsage();
  for (const n of notes) {
    for (const r of n.rels) add(n.id, find(r.to, n.id)?.id, r.kind);
    const hub = hubs.get(n.domain);
    if (hub && hub.id !== n.id) add(hub.id, n.id, 'hub');
  }
  const profile = notes.find((n) => n.type === 'profile');
  if (profile) for (const h of hubs.values()) add(profile.id, h.id, 'domain');
  const graph = {
    generated: new Date().toISOString(),
    nodes: notes.map((n) => ({ id: n.id, type: n.type, title: n.title, description: n.description, path: n.path, status: n.status, domain: n.domain, uses: usage.count.get(n.id) ?? 0 })),
    edges,
  };
  writeFileSync(path.join(BRAIN, 'graph.json'), JSON.stringify(graph, null, 2));
  return graph;
}

/** brain/index.md: the table of contents, grouped by domain, hubs first. */
export function buildIndex(notes = loadNotes()) {
  const groups = new Map();
  for (const n of notes) {
    if (['feedback', 'eval'].includes(n.type)) continue;
    const g = n.type === 'profile' ? '(this brain)' : n.domain || (n.type === 'source' ? '(sources)' : n.type === 'deliverable' ? '(deliverables)' : '(general)');
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(n);
  }
  const order = (g) => (g === '(this brain)' ? 0 : g.startsWith('(') ? 2 : 1);
  let out = '# Index\n\nGenerated by `node engine/tools/brain.mjs index`. Do not edit by hand: edit the notes, then refresh.\n';
  for (const [g, list] of [...groups.entries()].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))) {
    out += `\n## ${g}\n\n`;
    list.sort((a, b) => (a.type === 'hub' ? -1 : b.type === 'hub' ? 1 : a.title.localeCompare(b.title)));
    for (const n of list) out += `- [${n.title}](${n.id}.md): ${n.type}${n.status !== 'active' ? `, ${n.status}` : ''}. ${n.description}\n`;
  }
  writeFileSync(path.join(BRAIN, 'index.md'), out);
  return out;
}

/**
 * brain/routing.md holds the memory paths: "when asked about X, start with these notes".
 * The curated table above the marker is the brain's own; the generated block below it lists each domain's hub and key notes.
 */
export function buildRoutes(notes = loadNotes()) {
  const file = path.join(BRAIN, 'routing.md');
  const MARK = '<!-- generated below: node engine/tools/brain.mjs routes -->';
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '# Routing\n\nMemory paths: where to look first for each kind of question.\n\n| When asked about | Start with |\n| --- | --- |\n';
  const head = current.includes(MARK) ? current.slice(0, current.indexOf(MARK)) : current.trimEnd() + '\n\n';
  let gen = `${MARK}\n\n## Domains (generated)\n\n`;
  const domains = [...new Set(notes.map((n) => n.domain).filter(Boolean))].sort();
  for (const d of domains) {
    const inD = notes.filter((n) => n.domain === d && n.status !== 'deprecated');
    const hub = inD.find((n) => n.type === 'hub');
    const key = inD.filter((n) => n.type !== 'hub').sort((a, b) => b.mtime - a.mtime).slice(0, 6);
    gen += `- **${d}** → ${hub ? `[${hub.title}](${hub.id}.md)` : '(no hub yet)'}${key.length ? `; key notes: ${key.map((n) => `[${n.title}](${n.id}.md)`).join(', ')}` : ''}\n`;
  }
  if (!domains.length) gen += '- No domains yet. Run setup, or `node engine/tools/brain.mjs new-domain NAME "what it covers"`.\n';
  gen += `\n## By kind of question (generated)\n\n`;
  const kinds = [['who someone is, their role', 'people'], ['an organization', 'organizations'], ['a project, its status or owner', 'projects'], ['what was decided, by whom, why', 'decisions'], ['risks, what could go wrong', 'risks'], ['what a word or acronym means', 'glossary'], ['where something came from', 'sources'], ['what is still unanswered', 'open-questions']];
  for (const [q, f] of kinds) gen += `- ${q} → [${f}](registers/${f}.md)\n`;
  const usage = readUsage();
  const byId = new Map(notes.map((n) => [n.id, n]));
  const hot = [...usage.count.entries()].filter(([id]) => byId.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (hot.length) { gen += `\n## Most used (generated from brain/ledger.jsonl)\n\n`; for (const [id, c] of hot) gen += `- [${byId.get(id).title}](${id}.md): used ${c} time${c === 1 ? '' : 's'}\n`; }
  writeFileSync(file, head + gen);
}

/** Health check: errors break the brain; warnings make it worse at finding things. */
export function check(notes = loadNotes()) {
  const errors = [], warnings = [], suggestions = [];
  const find = resolver(notes);
  const linkedTo = new Set();
  const titles = new Map();
  for (const n of notes) {
    const where = n.path;
    if (!Object.keys(n.meta).length) warnings.push(`${where}: no front matter (type, title, description)`);
    if (!TYPES.includes(n.type)) errors.push(`${where}: unknown type "${n.type}" (use one of: ${TYPES.join(', ')})`);
    if (!STATUSES.includes(n.status)) errors.push(`${where}: unknown status "${n.status}"`);
    if (!n.description) warnings.push(`${where}: no description (a one-line summary helps the brain find it)`);
    for (const r of n.rels) {
      const t = find(r.to, n.id);
      if (t) linkedTo.add(t.id);
      else if (!r.soft) errors.push(`${where}: broken link to "${r.to}"`);
      else if (['involves', 'owned-by', 'decided-by', 'with', 'part-of'].includes(r.kind) && /[a-z]/i.test(r.to)) suggestions.push(`${where}: "${r.to}" (${r.kind}) has no note yet`);
    }
    if (['fact', 'decision', 'person', 'organization', 'howto', 'note'].includes(n.type) && n.status === 'active' && n.id !== 'log' && !/sources?:/i.test(n.body) && !n.meta.sources)
      warnings.push(`${where}: no Sources line (say where this came from)`);
    for (const f of NEEDS[n.type] ?? []) if (n.status !== 'deprecated' && !n.meta[f]) warnings.push(`${where}: ${n.type} without ${f}`);
    // Writing: plain and human. These are warnings the brain fixes like any other.
    const text = n.body.replace(/```[\s\S]*?```/g, '');
    if (text.includes(String.fromCharCode(8212))) warnings.push(`${where}: em dash (use a comma, colon, period or parentheses)`);
    // Words quoted as examples ("delve", `leverage`) are not the brain's own wording.
    const own = text.replace(/`[^`\n]*`/g, '').replace(/"[^"\n]*"/g, '').replace(/“[^”\n]*”/g, '');
    const slop = [...new Set([...own.matchAll(SLOP)].map((m) => m[0].toLowerCase()))];
    if (slop.length) warnings.push(`${where}: stock AI wording (${slop.slice(0, 5).join(', ')}): say the plain thing`);
    if (n.body.length > 6000 && !['source', 'deliverable'].includes(n.type)) warnings.push(`${where}: long note (${n.body.length} characters): split it into smaller linked notes`);
    const t = n.title.toLowerCase();
    if (titles.has(t)) warnings.push(`${where}: same title as ${titles.get(t)}`); else titles.set(t, where);
    if (n.domain && !notes.some((h) => h.type === 'hub' && h.domain === n.domain)) warnings.push(`${where}: domain "${n.domain}" has no hub (_hub.md)`);
  }
  for (const n of notes) {
    if (['profile', 'hub', 'feedback', 'eval', 'deliverable'].includes(n.type) || n.domain) continue;
    if (!linkedTo.has(n.id) && !n.links.length) warnings.push(`${n.path}: orphan (no domain and no links in or out)`);
  }
  const routing = path.join(BRAIN, 'routing.md');
  if (existsSync(routing)) {
    const txt = readFileSync(routing, 'utf8');
    for (const m of txt.matchAll(/\]\(([^)\s]+\.md)\)/g)) if (!existsSync(path.join(BRAIN, m[1]))) errors.push(`brain/routing.md: memory path points to missing ${m[1]}`);
  }
  const inbox = path.join(BRAIN, 'inbox');
  const waiting = existsSync(inbox) ? readdirSync(inbox).filter((f) => !f.startsWith('.') && f !== 'processed' && f.toLowerCase() !== 'readme.md') : [];
  const info = waiting.length ? [`${waiting.length} file(s) waiting in brain/inbox`] : [];
  if (suggestions.length) info.push(`${suggestions.length} name(s) mentioned without their own note: ${[...new Set(suggestions.map((x) => x.split('"')[1]))].slice(0, 8).join(', ')}`);
  return { errors, warnings, info, notes: notes.length };
}

// ---- registers: one list per kind of thing, rebuilt from the notes ----

const REGISTERS = [
  { file: 'people', title: 'People', types: ['person'], cols: ['role', 'organization', 'projects'] },
  { file: 'organizations', title: 'Organizations', types: ['organization'], cols: ['kind', 'people'] },
  { file: 'projects', title: 'Projects', types: ['project'], cols: ['status', 'owner', 'due'] },
  { file: 'decisions', title: 'Decisions', types: ['decision'], cols: ['date', 'decided_by', 'projects'], sort: 'date' },
  { file: 'risks', title: 'Risks', types: ['risk'], cols: ['severity', 'likelihood', 'owner', 'status'], sort: 'severity' },
  { file: 'glossary', title: 'Glossary', types: ['term'], cols: ['aka'] },
  { file: 'sources', title: 'Sources', types: ['source'], cols: ['date', 'author'], sort: 'date' },
  { file: 'open-questions', title: 'Open questions', types: ['question'], cols: ['owner', 'projects'] },
];
const SEVERITY = { critical: 0, high: 1, medium: 2, low: 3 };
const cell = (v) => [].concat(v ?? '').join(', ').replace(/\|/g, '/') || ' ';

/** brain/registers/*.md: people, organizations, projects, decisions, risks, glossary, sources, open questions. */
export function buildRegisters(notes = loadNotes()) {
  const dir = path.join(BRAIN, 'registers');
  mkdirSync(dir, { recursive: true });
  const made = [];
  for (const r of REGISTERS) {
    let list = notes.filter((n) => r.types.includes(n.type) && n.status !== 'deprecated');
    if (r.sort === 'date') list.sort((a, b) => String(b.meta.date ?? '').localeCompare(String(a.meta.date ?? '')));
    else if (r.sort === 'severity') list.sort((a, b) => (SEVERITY[String(a.meta.severity).toLowerCase()] ?? 9) - (SEVERITY[String(b.meta.severity).toLowerCase()] ?? 9));
    else list.sort((a, b) => a.title.localeCompare(b.title));
    let out = `# ${r.title}\n\nGenerated by \`node engine/tools/brain.mjs refresh\` from the ${r.types[0]} notes. Edit the notes, not this file.\n\n`;
    if (!list.length) out += `None yet.\n`;
    else {
      out += `| ${r.title.replace(/s$/, '')} | ${r.cols.map((c) => c.replace(/_/g, ' ')).join(' | ')} | Summary |\n|${' --- |'.repeat(r.cols.length + 2)}\n`;
      for (const n of list) out += `| [${n.title}](../${n.id}.md) | ${r.cols.map((c) => cell(n.meta[c])).join(' | ')} | ${cell(n.description)} |\n`;
    }
    writeFileSync(path.join(dir, `${r.file}.md`), out);
    made.push({ ...r, count: list.length });
  }
  return made;
}

// ---- usage: which notes answer which questions, so the paths can learn ----

const LEDGER = () => path.join(BRAIN, 'ledger.jsonl');

/** Records that these notes answered a question. `searched` means no memory path led there. */
export function recordUse(ids, q = '', searched = false) {
  const find = resolver(loadNotes()); // "water-cutoff" or "brain/notes/garden/water-cutoff.md" both become the note's id
  const clean = ids.map((x) => String(x).replace(/^brain\//, '').replace(/\.md$/, '')).map((x) => find(x)?.id ?? x);
  const line = JSON.stringify({ at: new Date().toISOString(), q: String(q).slice(0, 200), notes: clean, searched });
  writeFileSync(LEDGER(), (existsSync(LEDGER()) ? readFileSync(LEDGER(), 'utf8') : '') + line + '\n');
}

export function readUsage() {
  const count = new Map(), pairs = new Map(), searched = [];
  if (!existsSync(LEDGER())) return { count, pairs, searched, total: 0 };
  let total = 0;
  const find = resolver(loadNotes());
  for (const line of readFileSync(LEDGER(), 'utf8').split('\n')) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    total++;
    e.notes = (e.notes ?? []).map((x) => find(String(x))?.id ?? x);
    const ids = [...new Set(e.notes)];
    for (const id of ids) count.set(id, (count.get(id) ?? 0) + 1);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const k = [ids[i], ids[j]].sort().join('|'); pairs.set(k, (pairs.get(k) ?? 0) + 1); }
    if (e.searched) searched.push(e);
  }
  return { count, pairs, searched, total };
}

/** What the usage record says to improve: hot notes, notes used together but not linked, questions with no path. */
export function learn(notes = loadNotes()) {
  const u = readUsage();
  const ids = new Set(notes.map((n) => n.id));
  const linked = new Set();
  const find = resolver(notes);
  for (const n of notes) for (const l of n.links) { const t = find(l, n.id); if (t) linked.add([n.id, t.id].sort().join('|')); }
  const hot = [...u.count.entries()].filter(([id]) => ids.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const linkThese = [...u.pairs.entries()].filter(([k, c]) => c >= 2 && !linked.has(k) && k.split('|').every((x) => ids.has(x))).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const full = existsSync(path.join(BRAIN, 'routing.md')) ? readFileSync(path.join(BRAIN, 'routing.md'), 'utf8') : '';
  const routing = full.split('<!-- generated below')[0]; // only the curated paths count
  const unrouted = u.searched.filter((e) => e.notes?.length && !e.notes.some((id) => routing.includes(`${id}.md`))).slice(-10);
  const cold = notes.filter((n) => ['fact', 'howto', 'note'].includes(n.type) && n.status === 'active' && !u.count.get(n.id) && Date.now() - n.mtime > 90 * 86400000).map((n) => n.id).slice(0, 10);
  return { total: u.total, hot, linkThese, unrouted, cold };
}

// ---- status: what waits on a person (the app reads this format) ----

export function status(who) {
  const me = String(who || '').toLowerCase();
  const mine = (v) => !me || String(v ?? '').toLowerCase().includes(me);
  const lines = [];
  const fb = loadNotes().filter((n) => n.type === 'feedback' && n.status === 'open' && mine(n.meta.who ?? n.meta.owner ?? me));
  lines.push(`Brain status for ${who || 'everyone'}`);
  lines.push(`  Waiting on ${who || 'anyone'}`);
  for (const n of fb) {
    const m = path.posix.basename(n.id).match(/^(\d{4}-\d{2}-\d{2})/);
    const age = m ? Math.max(0, Math.round((Date.now() - Date.parse(m[1])) / 86400000)) : null;
    lines.push(`    ${age === null ? 'age unknown' : age + 'd'}  feedback  open  ${path.posix.basename(n.id)}  ${n.description}`);
  }
  lines.push(`Checkpoints awaiting ${who || 'anyone'}`);
  const runs = path.join(BRAIN, 'runs');
  for (const f of existsSync(runs) ? readdirSync(runs).filter((x) => x.endsWith('.json')).sort() : []) {
    try {
      const data = JSON.parse(readFileSync(path.join(runs, f), 'utf8'));
      const last = Array.isArray(data.steps) ? data.steps[data.steps.length - 1] : null;
      if (last && /awaiting/i.test(String(last.status)) && mine(last.status)) lines.push(`    ${f.replace(/\.json$/, '')}  ${last.words ?? ''}`);
    } catch {}
  }
  return lines.join('\n');
}

// ---- making things ----

function write(file, text) { mkdirSync(path.dirname(file), { recursive: true }); if (existsSync(file)) throw new Error(`${rel(file)} already exists`); writeFileSync(file, text); return rel(file); }

export function newDomain(name, what = '') {
  const d = slugify(name);
  if (!d) throw new Error('give the domain a name');
  return write(path.join(BRAIN, 'notes', d, '_hub.md'),
    `---\ntype: hub\ntitle: ${name}\ndescription: ${what || `Everything this brain knows about ${name}.`}\ndomain: ${d}\nstatus: active\n---\n\n# ${name}\n\n${what}\n\n## Key notes\n\n(Link the most important notes here, like \`[[note-name]]\`.)\n\n## Open questions\n\n- \n`);
}

/** Extra front matter each type starts with, so registers and links fill in. */
const TEMPLATE = {
  person: 'role: \norganization: \nprojects: []\n',
  organization: 'kind: \npeople: []\n',
  project: 'owner: \ndue: \npeople: []\nrisks: []\ndecisions: []\n',
  decision: 'date: \ndecided_by: \nprojects: []\nsupersedes: \n',
  risk: 'severity: medium\nlikelihood: medium\nowner: \nprojects: []\nmitigation: \n',
  term: 'aka: []\n',
  question: 'owner: \nprojects: []\n',
};

export function newNote(domain, slug, title, type = 'fact') {
  if (!TYPES.includes(type)) throw new Error(`unknown type "${type}" (use one of: ${TYPES.join(', ')})`);
  const d = slugify(domain), s = slugify(slug || title);
  return write(path.join(BRAIN, 'notes', d, `${s}.md`),
    `---\ntype: ${type}\ntitle: ${title || s}\ndescription: \ndomain: ${d}\nstatus: active\n${TEMPLATE[type] ?? ''}---\n\n# ${title || s}\n\n\n\nRelated: [[_hub]]\n\nSources: \n`);
}

export function run(action, a, b, rest) {
  const dir = path.join(BRAIN, 'runs');
  mkdirSync(dir, { recursive: true });
  if (action === 'new') {
    const id = `${today()}-${slugify(a || 'run')}`;
    writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ id, goal: b || '', started: new Date().toISOString(), steps: [] }, null, 2));
    return id;
  }
  const file = path.join(dir, `${a}.json`);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (action === 'step') {
    const i = rest.indexOf('--await');
    const step = { step: b, at: new Date().toISOString(), status: 'done' };
    if (i >= 0) { step.status = `awaiting ${rest[i + 1]}`; step.words = rest[i + 2] ?? ''; }
    data.steps.push(step);
  } else if (action === 'done') {
    data.finished = new Date().toISOString();
    data.steps.push({ step: 'finished', at: data.finished, status: 'done' });
  } else throw new Error('run new | step | done');
  writeFileSync(file, JSON.stringify(data, null, 2));
  return a;
}

// ---- command line ----

function report(r) {
  for (const e of r.errors) console.log('ERROR  ' + e);
  for (const w of r.warnings) console.log('warn   ' + w);
  for (const i of r.info) console.log('info   ' + i);
  console.log(`${r.errors.length ? 'NOT HEALTHY' : 'HEALTHY'}: ${r.notes} notes, ${r.errors.length} errors, ${r.warnings.length} warnings`);
  return r.errors.length ? 1 : 0;
}

// ---- hooks: run by Claude Code itself (see .claude/settings.json), so upkeep costs no AI tokens ----

const STATE = () => path.join(BRAIN, '.state.json');
const readState = () => { try { return JSON.parse(readFileSync(STATE(), 'utf8')); } catch { return {}; } };
const writeState = (s) => writeFileSync(STATE(), JSON.stringify(s, null, 2));
const turnFile = (sid) => path.join(BRAIN, `.turn-${slugify(sid || 'session') || 'session'}.json`);
const readStdin = () => { try { return JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return {}; } };

/** Newest change to anything under brain/ that the generated files are built from. */
function newestNoteChange() {
  let t = 0;
  for (const f of walk(BRAIN)) t = Math.max(t, statSync(f).mtimeMs);
  const routing = path.join(BRAIN, 'routing.md');
  if (existsSync(routing)) t = Math.max(t, statSync(routing).mtimeMs);
  return t;
}

/** The refresh everyone needs, quietly; returns the health result. */
export function quietRefresh() {
  const notes = loadNotes();
  buildIndex(notes); buildRegisters(notes); buildRoutes(notes); buildGraph(loadNotes());
  return check(loadNotes());
}

/** The person's own words, without anything the app put in front of them. */
const cleanQuestion = (p) => String(p ?? '').replace(/^\[[^\]]*?display note[\s\S]*?\]\s*/i, '').replace(/\s+/g, ' ').trim().slice(0, 200);

export function hook(event, input = {}) {
  const sid = input.session_id;
  if (event === 'prompt') {
    writeFileSync(turnFile(sid), JSON.stringify({ q: cleanQuestion(input.prompt), reads: [], searched: false }));
    return null;
  }
  if (event === 'tool') {
    const f = turnFile(sid);
    if (!existsSync(f)) return null;
    const t = JSON.parse(readFileSync(f, 'utf8'));
    const tool = input.tool_name, ti = input.tool_input ?? {};
    if (tool === 'Read' && ti.file_path) {
      const r = rel(path.resolve(ROOT, ti.file_path));
      if (/^brain\/(notes|sources)\/.+\.md$/.test(r)) t.reads.push(r.replace(/^brain\//, '').replace(/\.md$/, ''));
    } else if (tool === 'Grep' || tool === 'Glob') t.searched = true;
    writeFileSync(f, JSON.stringify(t));
    return null;
  }
  if (event === 'stop') {
    // 1. Learn from this turn: which notes answered the question.
    const f = turnFile(sid);
    if (existsSync(f)) {
      const t = JSON.parse(readFileSync(f, 'utf8'));
      const reads = [...new Set(t.reads)].filter((id) => !id.endsWith('/_hub'));
      if (reads.length && t.q) recordUse(reads, t.q, t.searched);
      try { writeFileSync(f, JSON.stringify({ ...t, reads: [], searched: false })); } catch {}
    }
    // 2. Keep index, registers, memory paths and graph current, only when notes changed.
    const graph = path.join(BRAIN, 'graph.json');
    if (existsSync(graph) && newestNoteChange() <= statSync(graph).mtimeMs) return null;
    const r = quietRefresh();
    // 3. Broken links or bad types: ask the brain to fix them before it finishes (once, never in a loop).
    if (r.errors.length && !input.stop_hook_active) return { decision: 'block', reason: `The brain check found ${r.errors.length} problem(s) from this turn. Fix them, then finish:\n${r.errors.slice(0, 8).join('\n')}` };
    return null;
  }
  if (event === 'start') {
    // Suggest consolidating at most once a week, and only when there is something to learn from.
    const s = readState();
    const profile = existsSync(path.join(BRAIN, 'profile.md')) ? readFileSync(path.join(BRAIN, 'profile.md'), 'utf8') : '';
    if (!/status:\s*active/.test(profile)) return null;
    // First conversation: one welcome line with three things to try, once.
    if (!s.welcomed) {
      s.welcomed = new Date().toISOString(); s.createdAt ??= s.welcomed; writeState(s);
      return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'This is the first conversation with this brain. Answer the person normally, then end your reply with one short line: "Things to try:" followed by three short examples taken from the table of things to say in START-HERE.md, separated by commas. Do this only in this reply.' } };
    }
    const week = 7 * 86400000, now = Date.now();
    const last = Math.max(Date.parse(s.lastConsolidated ?? 0) || 0, Date.parse(s.createdAt ?? 0) || 0);
    if (!s.createdAt) { s.createdAt = new Date().toISOString(); writeState(s); return null; }
    const since = readUsage().total - (s.usesAtConsolidate ?? 0);
    if (now - last < week || since < 5) return null;
    if (s.lastSuggested && now - Date.parse(s.lastSuggested) < week) return null;
    s.lastSuggested = new Date().toISOString(); writeState(s);
    return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `It has been over a week since this brain last consolidated, and it has answered ${since} questions since. At the end of your first reply, add one short line offering to consolidate ("Want me to learn from this week and tidy up? It takes a minute."). Offer once; do not run it unless the person says yes.` } };
  }
  return null;
}

/** Marks a finished consolidate, so the weekly suggestion resets. */
export function markConsolidated() {
  const s = readState();
  s.lastConsolidated = new Date().toISOString();
  s.usesAtConsolidate = readUsage().total;
  writeState(s);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    mkdirSync(BRAIN, { recursive: true });
    if (cmd === 'hook') {
      // Never fail the conversation because of upkeep: any problem here is swallowed.
      try { const out = hook(args[0], readStdin()); if (out) process.stdout.write(JSON.stringify(out)); } catch {}
      process.exit(0);
    }
    if (cmd === 'consolidated') { markConsolidated(); console.log('marked consolidated'); }
    else if (cmd === 'refresh' || !cmd) {
      const notes = loadNotes();
      buildIndex(notes); buildRegisters(notes); buildRoutes(notes); const g = buildGraph(loadNotes());
      console.log(`Refreshed: ${g.nodes.length} notes, ${g.edges.length} links.`);
      process.exitCode = report(check(loadNotes()));
    } else if (cmd === 'graph') { const g = buildGraph(); console.log(`graph.json: ${g.nodes.length} notes, ${g.edges.length} links`); }
    else if (cmd === 'index') { buildIndex(); console.log('index.md rebuilt'); }
    else if (cmd === 'routes') { buildRoutes(); console.log('routing.md generated block rebuilt'); }
    else if (cmd === 'check') process.exitCode = report(check());
    else if (cmd === 'status') { const i = args.indexOf('--who'); console.log(status(i >= 0 ? args[i + 1] : '')); }
    else if (cmd === 'new-domain') console.log('created ' + newDomain(args[0], args.slice(1).join(' ')));
    else if (cmd === 'new-note') console.log('created ' + newNote(args[0], args[1], args[2], args[3]));
    else if (cmd === 'run') console.log(run(args[0], args[1], args[2], args.slice(3)));
    else if (cmd === 'registers') { for (const r of buildRegisters()) console.log(`registers/${r.file}.md: ${r.count}`); }
    else if (cmd === 'used') {
      const qi = args.indexOf('--q'); const q = qi >= 0 ? args[qi + 1] : '';
      const ids = args.filter((a, i) => !a.startsWith('--') && !(qi >= 0 && i === qi + 1));
      recordUse(ids, q, args.includes('--searched')); console.log(`recorded ${ids.length} note(s)`);
    }
    else if (cmd === 'learn') {
      const l = learn();
      console.log(`Usage record: ${l.total} answered question(s).`);
      console.log('Most used:'); for (const [id, c] of l.hot) console.log(`  ${c}x  ${id}`);
      console.log('Used together but not linked (link them):'); for (const [k, c] of l.linkThese) console.log(`  ${c}x  ${k.replace('|', '  <->  ')}`);
      console.log('Found only by searching (add a memory path):'); for (const e of l.unrouted) console.log(`  "${e.q}"  ->  ${e.notes.join(', ')}`);
      console.log('Never used in 90+ days (check still true):'); for (const id of l.cold) console.log(`  ${id}`);
    }
    else if (cmd === 'evals') for (const n of loadNotes().filter((x) => x.type === 'eval')) console.log(`${n.id}: ${n.meta.question ?? n.title}`);
    else { console.log('Commands: refresh, graph, index, routes, registers, check, status --who NAME, new-domain, new-note, run, evals, used, learn'); process.exitCode = 2; }
  } catch (e) { console.error('brain.mjs: ' + (e instanceof Error ? e.message : e)); process.exitCode = 2; }
}
