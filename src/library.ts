import { readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import type { Brain } from './brains.ts';

export type LibraryItem = { path: string; name: string; modified: string };
const SKIP = new Set(['source', 'archive', 'drafts', 'node_modules']);

/** Files the brain produced under brain/deliverables, newest first. */
export async function listLibrary(brain: Brain, limit = 50): Promise<LibraryItem[]> {
  const root = path.join(brain.path, 'brain', 'deliverables');
  const items: (LibraryItem & { t: number })[] = [];
  async function walk(dir: string, depth: number) {
    if (depth > 4) return;
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full, depth + 1);
      else {
        const s = await stat(full);
        items.push({ path: path.relative(brain.path, full).split(path.sep).join('/'), name: e.name, modified: s.mtime.toISOString(), t: s.mtimeMs });
      }
    }
  }
  await walk(root, 0);
  return items.sort((a, b) => b.t - a.t).slice(0, limit).map(({ t, ...i }) => i);
}

/** Opens a file in the system's default app if it exists inside the given folder (the workspace). */
export async function openWorkspaceFile(root: string, file: string): Promise<void> {
  const full = path.resolve(root, file.replace(/^\/([a-zA-Z])\//, '$1:/'));
  const rel = path.relative(path.resolve(root), full);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('That file is outside your workspace folder.');
  if (!(await stat(full).catch(() => null))?.isFile()) throw new Error('File not found.');
  if (process.platform === 'win32') spawn('explorer.exe', [full], { detached: true, stdio: 'ignore' }).unref();
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [full], { detached: true, stdio: 'ignore' }).unref();
}

/** Opens a brain file in the system's default app, refusing anything outside the brain. */
export function openFile(brain: Brain, relPath: string): void {
  const full = path.resolve(brain.path, relPath);
  const rel = path.relative(brain.path, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('outside-brain');
  if (process.platform === 'win32') spawn('explorer.exe', [full], { detached: true, stdio: 'ignore' }).unref();
  else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [full], { detached: true, stdio: 'ignore' }).unref();
}
