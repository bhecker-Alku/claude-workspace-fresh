import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readAliases, setAlias } from '../src/aliases.ts';
import { allBrains, type Brain } from '../src/brains.ts';
import { parseMentions } from '../src/teamup.ts';
import { createApp } from '../src/server.ts';

async function setup() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'ws-alias-'));
  const root = path.join(base, 'root');
  await mkdir(path.join(root, 'practice-brain'), { recursive: true });
  await writeFile(path.join(root, 'practice-brain', 'brain.yaml'), 'brain: acme-practice\n');
  return { root, dataDir: path.join(base, 'data') };
}

test('aliases are saved, trimmed, and cleared when empty', async () => {
  const { dataDir } = await setup();
  await setAlias(dataDir, 'practice-brain', { alias: '  Edgar ', role: 'Strategy & Commercial Lead', group: 'Practice' });
  assert.deepEqual((await readAliases(dataDir))['practice-brain'], { alias: 'Edgar', role: 'Strategy & Commercial Lead', group: 'Practice' });
  await setAlias(dataDir, 'practice-brain', { alias: '', role: '', group: '' });
  assert.equal((await readAliases(dataDir))['practice-brain'], undefined);
});

test('allBrains carries the alias, role and group', async () => {
  const { root, dataDir } = await setup();
  await setAlias(dataDir, 'practice-brain', { alias: 'Edgar', role: 'Lead', group: 'Practice' });
  const [b] = await allBrains(root, dataDir);
  assert.equal(b.alias, 'Edgar');
  assert.equal(b.role, 'Lead');
  assert.equal(b.group, 'Practice');
});

test('@Edgar mentions resolve by alias', () => {
  const brains: Brain[] = [{ id: 'practice-brain', name: 'acme-practice', alias: 'Edgar', path: '/x', level: '', profile: '', owner: '', blurb: '' }];
  assert.deepEqual(parseMentions('@edgar what is the floor?', brains), { brainIds: ['practice-brain'], rest: 'what is the floor?' });
});

test('alias route saves and the brain list shows it', async () => {
  const { root, dataDir } = await setup();
  const { app } = createApp({ brainsRoot: root, dataDir });
  const h = { host: '127.0.0.1:4317', 'content-type': 'application/json' };
  const r = await app.request('http://127.0.0.1:4317/api/brains/practice-brain/alias', { method: 'POST', headers: h, body: JSON.stringify({ alias: 'Edgar', role: 'Lead', group: 'Practice' }) });
  assert.equal(r.status, 200);
  const list = await (await app.request('http://127.0.0.1:4317/api/brains', { headers: h })).json();
  assert.equal(list[0].alias, 'Edgar');
  const bad = await app.request('http://127.0.0.1:4317/api/brains/practice-brain/alias', { method: 'POST', headers: h, body: JSON.stringify({ alias: 'x'.repeat(41) }) });
  assert.equal(bad.status, 400);
});

test('an avatar look is saved, and bad values are dropped', async () => {
  const { root, dataDir } = await setup();
  await setAlias(dataDir, 'practice-brain', { alias: 'Edgar', avatar: { color: 'purple', eyes: 'pill', mouth: 'smile', style: 'shadow' } });
  const [b] = await allBrains(root, dataDir);
  assert.deepEqual(b.avatar, { color: 'purple', eyes: 'pill', mouth: 'smile', style: 'shadow' });
  await setAlias(dataDir, 'practice-brain', { alias: 'Edgar', avatar: { color: 'red; x', eyes: 'pill', mouth: 'nope', style: 'jelly' } as any });
  assert.deepEqual((await readAliases(dataDir))['practice-brain'].avatar, { color: 'purple', eyes: 'pill', mouth: 'smile', style: 'jelly' });
});

test('a brain with no saved look gets a stable default look', async () => {
  const { root, dataDir } = await setup();
  const [a] = await allBrains(root, dataDir);
  const [b] = await allBrains(root, dataDir);
  assert.ok(a.avatar && a.avatar.color && a.avatar.eyes && a.avatar.mouth);
  assert.deepEqual(a.avatar, b.avatar);
});

test('a brain keeps its model; saving without one leaves it, an unknown one is dropped', async () => {
  const d = await mkdtemp(path.join(os.tmpdir(), 'ws-model-'));
  await setAlias(d, 'b', { alias: 'Bo', model: 'haiku' });
  assert.equal((await readAliases(d)).b.model, 'haiku');
  await setAlias(d, 'b', { alias: 'Bo2' });
  assert.equal((await readAliases(d)).b.model, 'haiku');
  await setAlias(d, 'b', { alias: 'Bo2', model: 'gpt-9' });
  assert.equal((await readAliases(d)).b.model, undefined);
  await setAlias(d, 'b', { alias: 'Bo2', model: '' });
  assert.equal((await readAliases(d)).b.model, undefined);
});

test('a themed avatar keeps its pack, character and choices; bad values are dropped', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'alias-theme-'));
  await setAlias(dataDir, 'practice-brain', { alias: 'Edgar', avatar: { color: 'teal', eyes: 'pill', mouth: 'smile', style: 'jelly', theme: 'halloween', character: 'pumpkin', packMouth: 'carved' } });
  assert.deepEqual((await readAliases(dataDir))['practice-brain'].avatar, { color: 'teal', eyes: 'pill', mouth: 'smile', style: 'jelly', theme: 'halloween', character: 'pumpkin', packMouth: 'carved' });
  await setAlias(dataDir, 'practice-brain', { alias: 'Edgar', avatar: { color: 'teal', eyes: 'pill', mouth: 'smile', style: 'jelly', theme: 'easter', character: '<script>' } as any });
  assert.deepEqual((await readAliases(dataDir))['practice-brain'].avatar, { color: 'teal', eyes: 'pill', mouth: 'smile', style: 'jelly' });
});
