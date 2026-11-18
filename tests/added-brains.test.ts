import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { addBrainFolder, allBrains, removeBrainFolder } from '../src/brains.ts';

async function setup() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'ws-added-'));
  const root = path.join(base, 'root');
  const elsewhere = path.join(base, 'elsewhere', 'client-brain');
  const notBrain = path.join(base, 'elsewhere', 'plain');
  await mkdir(path.join(root, 'practice-brain'), { recursive: true });
  await writeFile(path.join(root, 'practice-brain', 'brain.yaml'), 'brain: acme-practice\n');
  await mkdir(elsewhere, { recursive: true });
  await writeFile(path.join(elsewhere, 'brain.yaml'), 'brain: client\n');
  await mkdir(notBrain, { recursive: true });
  return { dataDir: path.join(base, 'data'), root, elsewhere, notBrain };
}

test('an added folder outside the root shows up and survives reload', async () => {
  const s = await setup();
  const added = await addBrainFolder(s.dataDir, s.elsewhere);
  assert.equal(added.name, 'client');
  assert.deepEqual((await allBrains(s.root, s.dataDir)).map((b) => b.name), ['acme-practice', 'client']);
});

test('a folder without brain.yaml is refused', async () => {
  const s = await setup();
  await assert.rejects(addBrainFolder(s.dataDir, s.notBrain), /not-a-brain/);
});

test('adding twice or adding one already under the root does not duplicate', async () => {
  const s = await setup();
  await addBrainFolder(s.dataDir, s.elsewhere);
  await addBrainFolder(s.dataDir, s.elsewhere);
  await addBrainFolder(s.dataDir, path.join(s.root, 'practice-brain'));
  assert.equal((await allBrains(s.root, s.dataDir)).length, 2);
});

test('an added brain can be removed from the list', async () => {
  const s = await setup();
  const added = await addBrainFolder(s.dataDir, s.elsewhere);
  await removeBrainFolder(s.dataDir, added.id);
  assert.deepEqual((await allBrains(s.root, s.dataDir)).map((b) => b.name), ['acme-practice']);
});

import { createApp } from '../src/server.ts';

test('folder routes list folders and add a brain or project', async () => {
  const s = await setup();
  const { app } = createApp({ brainsRoot: s.root, dataDir: s.dataDir });
  const h = { host: '127.0.0.1:4317', 'content-type': 'application/json' };
  const list = await (await app.request('http://127.0.0.1:4317/api/folders', { headers: h })).json();
  assert.deepEqual(list.folders.map((f: any) => [f.name, f.isBrain]), [['practice-brain', true]]);
  const add = (p: string) => app.request('http://127.0.0.1:4317/api/folders/add', { method: 'POST', body: JSON.stringify({ path: p }), headers: h });
  const r = await add(s.elsewhere);
  assert.equal(r.status, 201);
  assert.equal((await r.json()).name, 'client');
  assert.equal((await (await add(s.notBrain)).json()).kind, 'project');
  assert.equal((await add(path.join(s.root, 'missing'))).status, 400);
});
