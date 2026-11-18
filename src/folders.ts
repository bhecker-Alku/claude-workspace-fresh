import { readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type FolderList = { path: string; parent: string | null; folders: { name: string; path: string; isBrain: boolean }[] };

/** Lists the subfolders of a folder for the in-page folder browser. A missing folder falls back to the home folder. */
export async function listFolders(dir: string): Promise<FolderList> {
  let full = path.resolve(dir || os.homedir());
  if (!(await stat(full).then((s) => s.isDirectory(), () => false))) full = os.homedir();
  const entries = await readdir(full, { withFileTypes: true }).catch(() => []);
  const folders = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name.startsWith('$') || e.name === 'node_modules') continue;
    const p = path.join(full, e.name);
    const isBrain = await stat(path.join(p, 'brain.yaml')).then(() => true, () => false);
    folders.push({ name: e.name, path: p, isBrain });
  }
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const parent = path.dirname(full);
  return { path: full, parent: parent === full ? null : parent, folders };
}
