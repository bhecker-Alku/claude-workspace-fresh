import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { defaultAvatar, readAliases, type Avatar } from './aliases.ts';

export type Brain = { id: string; name: string; path: string; level: string; profile: string; owner: string; blurb: string; kind?: 'brain' | 'project'; alias?: string; role?: string; group?: string; avatar?: Avatar; model?: string; skillsOff?: string[]; appsOff?: string[] };

function blurbFrom(startHere: string): string {
  const lines = startHere.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '## What this brain is');
  if (start < 0) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n').trim().slice(0, 300);
}

async function readBrain(dir: string): Promise<Brain | null> {
  let meta: Record<string, unknown>;
  try {
    meta = parse(await readFile(path.join(dir, 'brain.yaml'), 'utf8'));
    if (!meta || typeof meta !== 'object' || typeof meta.brain !== 'string') throw new Error('no brain field');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn(`Skipping ${path.basename(dir)}: brain.yaml unreadable`);
    return null;
  }
  const start = await readFile(path.join(dir, 'START-HERE.md'), 'utf8').catch(() => '');
  return {
    id: path.basename(dir), name: meta.brain as string, path: dir,
    level: String(meta.level ?? ''), profile: String(meta.profile ?? ''), owner: String(meta.owner ?? ''),
    blurb: blurbFrom(start), kind: 'brain',
  };
}

/** A brain is a direct child folder of root that holds a readable brain.yaml. */
export async function discoverBrains(root: string): Promise<Brain[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const brains: Brain[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const b = await readBrain(path.join(root, e.name));
    if (b) brains.push(b);
  }
  return brains.sort((a, b) => a.name.localeCompare(b.name));
}

// Brains added by hand (folder picker) live in <dataDir>/added-brains.json as a list of folder paths.
const addedFile = (dataDir: string) => path.join(dataDir, 'added-brains.json');
async function readAdded(dataDir: string): Promise<string[]> {
  try {
    return JSON.parse(await readFile(addedFile(dataDir), 'utf8'));
  } catch {
    return [];
  }
}
async function writeAdded(dataDir: string, paths: string[]): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(addedFile(dataDir), JSON.stringify(paths, null, 2));
}
const same = (a: string, b: string) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

/** Brains in the root folder plus brains added by hand, without duplicates. */
export async function allBrains(root: string, dataDir: string): Promise<Brain[]> {
  const found = await discoverBrains(root);
  for (const dir of await readAdded(dataDir)) {
    if (found.some((b) => same(b.path, dir))) continue;
    const b = (await readBrain(dir)) ?? (await readProject(dir));
    if (!b) continue;
    while (found.some((x) => x.id === b.id)) b.id = `${b.id}-2`;
    found.push(b);
  }
  const aliases = await readAliases(dataDir);
  for (const b of found) {
    const a = aliases[b.id];
    if (a) Object.assign(b, { alias: a.alias || undefined, role: a.role || undefined, group: a.group || undefined, model: a.model || undefined, skillsOff: a.skillsOff, appsOff: a.appsOff });
    b.avatar = a?.avatar ?? defaultAvatar(b.id);
  }
  return found.sort((a, b) => (a.alias ?? a.name).localeCompare(b.alias ?? b.name));
}

/** The name people see: the alias when there is one. */
export const displayName = (b: Brain) => b.alias || b.name;

/** Any other folder is a project: a plain Claude Code chat in that folder. */
async function readProject(dir: string): Promise<Brain | null> {
  const ok = await stat(dir).then((s) => s.isDirectory(), () => false);
  if (!ok) return null;
  return { id: path.basename(dir), name: path.basename(dir), path: dir, level: '', profile: 'project', owner: '', blurb: '', kind: 'project' };
}

/** Adds a folder chosen by the person: a brain when it has brain.yaml, otherwise a project. */
export async function addFolder(dataDir: string, dir: string): Promise<Brain> {
  const full = path.resolve(dir);
  const b = (await readBrain(full)) ?? (await readProject(full));
  if (!b) throw new Error('not-a-folder');
  const list = await readAdded(dataDir);
  if (!list.some((p) => same(p, full))) await writeAdded(dataDir, [...list, full]);
  return b;
}

/** Adds a brain folder chosen by the person. Throws not-a-brain when it has no readable brain.yaml. */
export async function addBrainFolder(dataDir: string, dir: string): Promise<Brain> {
  const b = await readBrain(path.resolve(dir));
  if (!b) throw new Error('not-a-brain');
  const list = await readAdded(dataDir);
  if (!list.some((p) => same(p, dir))) await writeAdded(dataDir, [...list, path.resolve(dir)]);
  return b;
}

export async function removeBrainFolder(dataDir: string, id: string): Promise<void> {
  const list = await readAdded(dataDir);
  await writeAdded(dataDir, list.filter((p) => path.basename(p) !== id.replace(/(-2)+$/, '') && path.basename(p) !== id));
}

export type GraphNode = { id: string; type: string; title: string; description: string; path: string; status: string; domain: string };
export type Graph = { nodes: GraphNode[]; edges: { source: string; target: string }[] };

/** The brain's own note map (brain/graph.json, written by build_graph.py), trimmed to what the view draws. Empty when missing. */
export async function readGraph(brain: Brain): Promise<Graph> {
  let raw: any;
  try { raw = JSON.parse(await readFile(path.join(brain.path, 'brain', 'graph.json'), 'utf8')); } catch { return { nodes: [], edges: [] }; }
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const nodes: GraphNode[] = (Array.isArray(raw?.nodes) ? raw.nodes : []).filter((n: any) => n && typeof n.id === 'string').map((n: any) => ({
    id: n.id, type: s(n.type), title: s(n.title) || n.id, description: s(n.description), path: s(n.path).replace(/^\//, ''), status: s(n.status), domain: s(n.domain),
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const seen = new Set<string>();
  const edges = (Array.isArray(raw?.edges) ? raw.edges : []).filter((e: any) => {
    if (!ids.has(e?.source) || !ids.has(e?.target) || e.source === e.target) return false;
    const key = [e.source, e.target].sort().join('|');
    return seen.has(key) ? false : (seen.add(key), true);
  }).map((e: any) => ({ source: e.source, target: e.target }));
  return { nodes, edges };
}

export type Hit = { brainId: string; brainName: string; title: string; type: string; path: string };

/**
 * Notes whose title or description holds the text. Title start beats title anywhere beats description;
 * on a tie the current brain comes first, then by title. Old (deprecated) notes go last. Under 2 letters finds nothing.
 */
export function searchNotes(graphs: { brain: Brain; graph: Graph }[], q: string, currentId: string, limit = 8): Hit[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const scored: { hit: Hit; score: number; old: boolean; here: boolean }[] = [];
  for (const { brain, graph } of graphs) {
    for (const n of graph.nodes) {
      const title = n.title.toLowerCase();
      const score = title.startsWith(needle) ? 3 : title.includes(needle) ? 2 : n.description.toLowerCase().includes(needle) ? 1 : 0;
      if (!score) continue;
      scored.push({
        hit: { brainId: brain.id, brainName: brain.alias || brain.name, title: n.title, type: n.type, path: n.path },
        score, old: n.status === 'deprecated', here: brain.id === currentId,
      });
    }
  }
  scored.sort((a, b) => Number(a.old) - Number(b.old) || b.score - a.score || Number(b.here) - Number(a.here) || a.hit.title.localeCompare(b.hit.title));
  return scored.slice(0, limit).map((s) => s.hit);
}

export type Checkpoint ={ run: string; step: string; words: string };

/**
 * Checkpoints in this brain's run records that wait on one person. Read-only.
 * Same shapes brain_status.py reads: any `checkpoint*` object, and the last entry of `steps`.
 */
export async function readCheckpoints(brain: Brain, who: string): Promise<Checkpoint[]> {
  const dir = path.join(brain.path, 'brain', 'runs');
  let files: string[];
  try { files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort(); } catch { return []; }
  const out: Checkpoint[] = [];
  // Case-insensitive, and the name must end there: "human:sam" never matches "human:samantha".
  const name = who.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mine = new RegExp(`${name}(?![a-z0-9._-])`);
  const waits = (status: unknown) => typeof status === 'string' && status.toLowerCase().includes('awaiting') && mine.test(status.toLowerCase());
  for (const f of files) {
    let data: any;
    try { data = JSON.parse(await readFile(path.join(dir, f), 'utf8')); } catch { continue; }
    if (!data || typeof data !== 'object') continue;
    const run = f.replace(/\.json$/, '');
    for (const [key, val] of Object.entries<any>(data)) {
      if (key.startsWith('checkpoint') && val && typeof val === 'object' && waits(val.status)) {
        out.push({ run, step: key, words: typeof val.words === 'string' ? val.words : '' });
      }
    }
    const steps = Array.isArray(data.steps) ? data.steps : [];
    const last = steps[steps.length - 1];
    if (last && typeof last === 'object' && waits(last.status)) {
      out.push({ run, step: `steps[-1] ${last.step ?? ''}`.trim(), words: typeof last.words === 'string' ? last.words : '' });
    }
  }
  return out;
}

export type Waiting = { kind: string; age: number | null; title: string; note: string };

/** Turns a feedback file name into a plain title: drops the date and the dashes. */
export function plainTitle(slug: string): string {
  const t = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Reads `brain_status.py --who` output into the items and checkpoints waiting on that person. */
export function parseWaiting(text: string): Waiting[] {
  const out: Waiting[] = [];
  let section = '';
  for (const line of text.split(/\r?\n/)) {
    if (/^\s{2}Waiting on /.test(line)) { section = 'feedback'; continue; }
    if (/^Checkpoints awaiting/.test(line)) { section = 'checkpoints'; continue; }
    if (/^\S/.test(line)) { section = ''; continue; }
    if (section === 'feedback') {
      const m = line.match(/^\s+(\d+)d\s+(\S+)\s+\S+\s+(\S+)(?:\s{2}(.*))?$/) ?? line.match(/^\s+age unknown\s+(\S+)\s+\S+\s+(\S+)(?:\s{2}(.*))?$/);
      if (!m) continue;
      const dated = m.length === 5;
      out.push({ kind: dated ? m[2] : m[1], age: dated ? Number(m[1]) : null, title: plainTitle(dated ? m[3] : m[2]), note: (dated ? m[4] : m[3]) ?? '' });
    } else if (section === 'checkpoints') {
      const m = line.match(/^\s+(\S+)\s+(.*)$/);
      if (m) out.push({ kind: 'checkpoint', age: null, title: plainTitle(m[1]), note: '' });
    }
  }
  return out;
}

/** What waits on one person in this brain, from the brain's own status tool. Empty when the tool is missing or fails. */
export function brainStatus(brain: Brain, who: string): Promise<Waiting[]> {
  // The Node engine (starter brains) needs no Python; the Python tool is for older brains.
  const nodeTool = path.join(brain.path, 'engine', 'tools', 'brain.mjs');
  if (existsSync(nodeTool)) {
    return new Promise((resolve) => {
      execFile(process.execPath, [nodeTool, 'status', '--who', who], { cwd: brain.path, timeout: 20_000, windowsHide: true }, (err, stdout) => resolve(err ? [] : parseWaiting(stdout)));
    });
  }
  const py = process.platform === 'win32' ? 'py' : 'python3';
  return new Promise((resolve) => {
    execFile(py, ['engine/tools/brain_status.py', '--who', who], { cwd: brain.path, timeout: 20_000, windowsHide: true }, (err, stdout) => resolve(err ? [] : parseWaiting(stdout)));
  });
}
