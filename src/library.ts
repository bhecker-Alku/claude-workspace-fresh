import { readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
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

const inside = (dir: string, full: string) => { const rel = path.relative(path.resolve(dir), full); return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel); };
/** Never opened from chat: anything that runs code. */
const RUNS_CODE = /\.(exe|bat|cmd|com|ps1|psm1|vbs|vbe|js|mjs|cjs|jse|wsf|wsh|msi|msp|scr|lnk|reg|hta|cpl|jar|sh|py)$/i;
/** Outside the workspace (Downloads, Documents...) only these document types open. */
export const OPENABLE = /\.(docx|doc|pdf|pptx|ppt|xlsx|xls|csv|txt|md|rtf|png|jpg|jpeg|gif|sav|spv)$/i;

/** Whether a chat link may open this file: inside the workspace (any non-program file), or a document in the person's own folders (never ~/.claude). */
export function canOpen(full: string, root: string, home = os.homedir()): boolean {
  if (!path.isAbsolute(full) || RUNS_CODE.test(full)) return false;
  if (inside(root, full)) return true;
  return inside(home, full) && !inside(path.join(home, '.claude'), full) && OPENABLE.test(full);
}

/** Opens a file from a chat link in the system's default app. */
export async function openWorkspaceFile(root: string, file: string): Promise<void> {
  const full = path.resolve(file.replace(/^\/([a-zA-Z])\//, '$1:/'));
  if (!canOpen(full, root)) throw new Error("That file can't be opened from chat.");
  if (!(await stat(full).catch(() => null))?.isFile()) throw new Error('That file is not there any more.');
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
