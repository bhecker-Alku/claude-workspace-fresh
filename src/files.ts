import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Brain } from './brains.ts';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES = 10;

function safeName(name: string): string {
  const base = path.basename(name.replace(/\\/g, '/')).replace(/\.\.+/g, '.').replace(/[^A-Za-z0-9._ -]/g, '_').trim();
  return base && base !== '.' ? base : 'file';
}

async function exists(p: string): Promise<boolean> {
  return stat(p).then(() => true, () => false);
}

/**
 * Saves dropped files. A brain gets them in its own inbox (brain-relative paths back).
 * A project gets them in the Workspace's uploads folder, one folder per project (full paths back),
 * so nothing is written into the project itself.
 */
export async function saveDrop(brain: Brain, files: { name: string; data: ArrayBuffer }[], uploadsRoot?: string): Promise<string[]> {
  if (files.length > MAX_FILES) throw new Error('too-many');
  if (files.some((f) => f.data.byteLength > MAX_FILE_BYTES)) throw new Error('too-large');
  const project = brain.kind === 'project';
  if (project && !uploadsRoot) throw new Error('no-uploads-folder');
  const inbox = project ? path.join(uploadsRoot!, safeName(brain.id)) : path.join(brain.path, 'brain', 'inbox');
  const rel = project ? inbox : 'brain/inbox';
  await mkdir(inbox, { recursive: true });
  const saved: string[] = [];
  for (const f of files) {
    const name = safeName(f.name);
    const ext = path.extname(name);
    const stem = name.slice(0, name.length - ext.length);
    let candidate = name;
    for (let i = 1; await exists(path.join(inbox, candidate)); i++) candidate = `${stem}-${i}${ext}`;
    await writeFile(path.join(inbox, candidate), Buffer.from(f.data));
    saved.push(project ? path.join(rel, candidate) : `${rel}/${candidate}`);
  }
  return saved;
}

export function dropMessage(paths: string[], kind: Brain['kind'] = 'brain'): string {
  if (kind === 'project') return `I uploaded these files: ${paths.join(', ')}. Please take a look.`;
  return `I added these files to the inbox: ${paths.join(', ')}. Please process the inbox.`;
}
