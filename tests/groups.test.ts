import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { addGroup, deleteGroup, listGroups, moveToGroup, renameGroup } from '../src/groups.ts';
import { readAliases, setAlias } from '../src/aliases.ts';
import { createStore } from '../src/store.ts';
import { createApp } from '../src/server.ts';

const dir = () => mkdtemp(path.join(os.tmpdir(), 'ws-groups-'));

test('groups can be added, listed in order, renamed and deleted', async () => {
  const d = await dir();
  await addGroup(d, 'Client Leads');
  await addGroup(d, 'IT');
  await addGroup(d, 'IT');
  assert.deepEqual(await listGroups(d), ['Client Leads', 'IT']);
  await setAlias(d, 'client-brain', { alias: 'Acme', role: 'Client Lead', group: 'Client Leads' });
  await renameGroup(d, 'Client Leads', 'Clients');
  assert.deepEqual(await listGroups(d), ['Clients', 'IT']);
  assert.equal((await readAliases(d))['client-brain'].group, 'Clients');
  await deleteGroup(d, 'Clients');
  assert.deepEqual(await listGroups(d), ['IT']);
  const a = (await readAliases(d))['client-brain'];
  assert.equal(a.group, '');
  assert.equal(a.alias, 'Acme');
});

test('moving a brain keeps its name, role and look, and adds the group if new', async () => {
  const d = await dir();
  await setAlias(d, 'practice-brain', { alias: 'Edgar', role: 'Lead', group: '', avatar: { color: 'teal', eyes: 'pill', mouth: 'grin', style: 'shadow' } });
  await moveToGroup(d, 'practice-brain', 'Practice');
  const a = (await readAliases(d))['practice-brain'];
  assert.equal(a.group, 'Practice');
  assert.equal(a.alias, 'Edgar');
  assert.equal(a.avatar?.color, 'teal');
  assert.deepEqual(await listGroups(d), ['Practice']);
});

test('renaming onto an existing group merges them', async () => {
  const d = await dir();
  await addGroup(d, 'A');
  await addGroup(d, 'B');
  await moveToGroup(d, 'x', 'A');
  await renameGroup(d, 'A', 'B');
  assert.deepEqual(await listGroups(d), ['B']);
  assert.equal((await readAliases(d)).x.group, 'B');
});

test('a chat can be deleted with its history', async () => {
  const d = await dir();
  const s = createStore(d);
  const a = await s.create('p', 'one');
  const b = await s.create('p', 'two');
  await s.appendTranscript(a.id, { type: 'user', text: 'hi' });
  await s.remove(a.id);
  assert.deepEqual((await s.list()).map((c) => c.id), [b.id]);
  assert.deepEqual(await s.readTranscript(a.id), []);
  await s.removeAll('p');
  assert.deepEqual(await s.list(), []);
});

test('routes: groups, move, delete chat, clear chats', async () => {
  const base = await dir();
  const root = path.join(base, 'root');
  await mkdir(path.join(root, 'practice-brain'), { recursive: true });
  await writeFile(path.join(root, 'practice-brain', 'brain.yaml'), 'brain: acme-practice\n');
  const { app, store } = createApp({ brainsRoot: root, dataDir: path.join(base, 'data') });
  const h = { host: '127.0.0.1:4317', 'content-type': 'application/json' };
  const post = (u: string, body: object = {}) => app.request('http://127.0.0.1:4317' + u, { method: 'POST', headers: h, body: JSON.stringify(body) });
  assert.equal((await post('/api/groups', { name: 'Practice' })).status, 200);
  assert.equal((await post('/api/groups', { name: '' })).status, 400);
  assert.equal((await post('/api/brains/practice-brain/group', { group: 'Practice' })).status, 200);
  assert.equal((await (await app.request('http://127.0.0.1:4317/api/brains', { headers: h })).json())[0].group, 'Practice');
  assert.equal((await post('/api/groups/rename', { from: 'Practice', to: 'Strategy' })).status, 200);
  assert.deepEqual(await (await app.request('http://127.0.0.1:4317/api/groups', { headers: h })).json(), ['Strategy']);
  const c = await store.create('practice-brain', 'dup');
  await store.create('practice-brain', 'dup2');
  assert.equal((await post(`/api/conversations/${c.id}/delete`)).status, 200);
  assert.equal((await store.list('practice-brain')).length, 1);
  assert.equal((await post('/api/brains/practice-brain/conversations/clear')).status, 200);
  assert.equal((await store.list('practice-brain')).length, 0);
  assert.equal((await post('/api/groups/delete', { name: 'Strategy' })).status, 200);
});
