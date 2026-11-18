import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.ts';

async function fixture(script?: () => AsyncGenerator<any>) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-srv-'));
  await mkdir(path.join(root, 'practice-brain'));
  await writeFile(path.join(root, 'practice-brain', 'brain.yaml'), 'brain: acme-practice\n');
  const queryFn = ((() => (script ?? (async function* () { yield { type: 'result', subtype: 'success', session_id: 's' }; }))()) as any);
  return createApp({ brainsRoot: root, dataDir: path.join(root, '.workspace'), queryFn });
}

test('brains route lists fixtures', async () => {
  const { app } = await fixture();
  const res = await app.request('/api/brains');
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).map((b: any) => b.name), ['acme-practice']);
});

test('busy returns 409', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { app } = await fixture(async function* () { await gate; yield { type: 'result', subtype: 'success', session_id: 's' }; });
  const conv = await (await app.request('/api/brains/practice-brain/conversations', { method: 'POST', body: JSON.stringify({ title: 'x' }), headers: { 'content-type': 'application/json' } })).json();
  const send = () => app.request(`/api/conversations/${conv.id}/messages`, { method: 'POST', body: JSON.stringify({ text: 'hi' }), headers: { 'content-type': 'application/json' } });
  assert.equal((await send()).status, 202);
  const second = await send();
  assert.equal(second.status, 409);
  assert.deepEqual(await second.json(), { error: 'brain is busy' });
  release();
});

test('events stream delivers a text event', async () => {
  const { app, emit } = await fixture();
  const res = await app.request('/api/events');
  const reader = res.body!.getReader();
  setTimeout(() => emit({ type: 'text', convId: 'c', text: 'hello' }), 10);
  let got = '';
  while (!got.includes('hello')) got += new TextDecoder().decode((await reader.read()).value);
  await reader.cancel();
  assert.match(got, /"type":"text"/);
});
