import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.ts';

const dir = () => mkdtemp(path.join(os.tmpdir(), 'workspace-store-'));

test('create then list by brain, newest first', async () => {
  const s = createStore(await dir());
  const a = await s.create('practice', 'first');
  await new Promise((r) => setTimeout(r, 5));
  const b = await s.create('practice', 'second');
  await s.create('client', 'other');
  assert.deepEqual((await s.list('practice')).map((c) => c.id), [b.id, a.id]);
  assert.equal(a.sessionId, null);
});

test('survives reload', async () => {
  const d = await dir();
  const c = await createStore(d).create('practice', 'x');
  await createStore(d).update(c.id, { sessionId: 'sess-1' });
  assert.equal((await createStore(d).get(c.id))?.sessionId, 'sess-1');
});

test('transcript round-trips', async () => {
  const s = createStore(await dir());
  const c = await s.create('practice', 'x');
  await s.appendTranscript(c.id, { type: 'user', text: 'hi' });
  await s.appendTranscript(c.id, { type: 'text', text: 'hello' });
  assert.deepEqual(await s.readTranscript(c.id), [{ type: 'user', text: 'hi' }, { type: 'text', text: 'hello' }]);
});
