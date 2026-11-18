import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.ts';

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-restart-'));
  await mkdir(path.join(root, 'practice-brain'));
  await writeFile(path.join(root, 'practice-brain', 'brain.yaml'), 'brain: acme-practice\n');
  let release = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  // A turn that only finishes when the test says so.
  const queryFn = (() => (async function* () { await gate; yield { type: 'result', subtype: 'success', session_id: 's' }; })()) as any;
  let restarts = 0;
  let shutdowns = 0;
  const { app } = createApp({ brainsRoot: root, dataDir: path.join(root, '.workspace'), queryFn,
    restartFn: () => { restarts++; }, shutdownFn: () => { shutdowns++; } });
  const req = (p: string, body?: unknown) => app.request(`http://127.0.0.1:4317${p}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { host: '127.0.0.1:4317', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { req, release, restarts: () => restarts, shutdowns: () => shutdowns };
}

const tick = () => new Promise((r) => setTimeout(r, 30));

test('restart right away when no brain is working', async () => {
  const s = await setup();
  const r = await s.req('/api/restart', {});
  assert.deepEqual(await r.json(), { waiting: false });
  for (let i = 0; i < 50 && s.restarts() === 0; i++) await tick();
  assert.equal(s.restarts(), 1);
});

test('once a restart is decided, no new turn can start and a double click restarts once', async () => {
  const s = await setup();
  const conv = await (await s.req('/api/brains/practice-brain/conversations', { title: 'x' })).json();
  await s.req('/api/restart', {});
  await s.req('/api/restart', {});
  assert.equal((await s.req(`/api/conversations/${conv.id}/messages`, { text: 'hi' })).status, 503);
  for (let i = 0; i < 50 && s.restarts() === 0; i++) await tick();
  await tick(); await tick();
  assert.equal(s.restarts(), 1);
});

test('restart waits for a running turn, then happens once', async () => {
  const s = await setup();
  const conv = await (await s.req('/api/brains/practice-brain/conversations', { title: 'x' })).json();
  assert.equal((await s.req(`/api/conversations/${conv.id}/messages`, { text: 'hi' })).status, 202);
  await tick();
  assert.deepEqual(await (await s.req('/api/restart', {})).json(), { waiting: true });
  assert.deepEqual(await (await s.req('/api/restart', {})).json(), { waiting: true });
  await tick();
  assert.equal(s.restarts(), 0, 'never mid-turn');
  s.release();
  for (let i = 0; i < 50 && s.restarts() === 0; i++) await tick();
  assert.equal(s.restarts(), 1);
  await tick(); await tick();
  assert.equal(s.restarts(), 1, 'only once');
});

test('shut down waits for a running turn, refuses new turns, and shuts down once', async () => {
  const s = await setup();
  const conv = await (await s.req('/api/brains/practice-brain/conversations', { title: 'x' })).json();
  assert.equal((await s.req(`/api/conversations/${conv.id}/messages`, { text: 'hi' })).status, 202);
  await tick();
  assert.deepEqual(await (await s.req('/api/shutdown', {})).json(), { waiting: true });
  await tick();
  assert.equal(s.shutdowns(), 0, 'never mid-turn');
  s.release();
  for (let i = 0; i < 50 && s.shutdowns() === 0; i++) await tick();
  assert.equal(s.shutdowns(), 1);
  assert.equal((await s.req(`/api/conversations/${conv.id}/messages`, { text: 'again' })).status, 503);
  assert.equal(s.restarts(), 0);
});

test('shut down wins over a restart that is still waiting', async () => {
  const s = await setup();
  const conv = await (await s.req('/api/brains/practice-brain/conversations', { title: 'x' })).json();
  await s.req(`/api/conversations/${conv.id}/messages`, { text: 'hi' });
  await tick();
  await s.req('/api/restart', {});
  await s.req('/api/shutdown', {});
  s.release();
  for (let i = 0; i < 50 && s.shutdowns() === 0; i++) await tick();
  await tick(); await tick();
  assert.deepEqual([s.shutdowns(), s.restarts()], [1, 0]);
});
