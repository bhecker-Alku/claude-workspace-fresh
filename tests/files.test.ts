import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, utimes } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { saveDrop, dropMessage } from '../src/files.ts';
import { listLibrary } from '../src/library.ts';
import type { Brain } from '../src/brains.ts';

async function brain(): Promise<Brain> {
  const p = await mkdtemp(path.join(os.tmpdir(), 'workspace-files-'));
  return { id: 'b', name: 'b', path: p, level: '', profile: '', owner: '', blurb: '' };
}
const data = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

test('sanitizes ../evil.txt into inbox and avoids clashes', async () => {
  const b = await brain();
  const saved = await saveDrop(b, [{ name: '../evil.txt', data: data('x') }, { name: 'evil.txt', data: data('y') }]);
  assert.deepEqual(saved, ['brain/inbox/evil.txt', 'brain/inbox/evil-1.txt']);
  assert.deepEqual((await readdir(path.join(b.path, 'brain', 'inbox'))).sort(), ['evil-1.txt', 'evil.txt']);
  assert.match(dropMessage(saved), /Please process the inbox\.$/);
});

test('project uploads go to the Workspace uploads folder, one folder per project, not into the project', async () => {
  const b = { ...(await brain()), id: 'claude', kind: 'project' as const };
  const uploads = await mkdtemp(path.join(os.tmpdir(), 'workspace-uploads-'));
  const saved = await saveDrop(b, [{ name: 'shot.png', data: data('x') }, { name: 'shot.png', data: data('y') }], uploads);
  assert.deepEqual(saved, [path.join(uploads, 'claude', 'shot.png'), path.join(uploads, 'claude', 'shot-1.png')]);
  assert.deepEqual(await readdir(b.path), []);
  assert.match(dropMessage(saved, 'project'), /I uploaded these files: .*shot\.png/);
});

test('rejects 11 files', async () => {
  const b = await brain();
  const files = Array.from({ length: 11 }, (_, i) => ({ name: `f${i}.txt`, data: data('x') }));
  await assert.rejects(saveDrop(b, files), /too-many/);
});

test('library is newest first and skips source folders', async () => {
  const b = await brain();
  const d = path.join(b.path, 'brain', 'deliverables', 'deck');
  await mkdir(path.join(d, 'source'), { recursive: true });
  await writeFile(path.join(d, 'old.pdf'), 'x');
  await writeFile(path.join(d, 'new.html'), 'x');
  await writeFile(path.join(d, 'source', 'build.py'), 'x');
  await utimes(path.join(d, 'old.pdf'), new Date(2020, 1, 1), new Date(2020, 1, 1));
  const items = await listLibrary(b);
  assert.deepEqual(items.map((i) => i.name), ['new.html', 'old.pdf']);
  assert.equal(items[0].path, 'brain/deliverables/deck/new.html');
});
