import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.ts';

test('update ready only once server code changes after the start', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-health-'));
  const code = path.join(root, 'code');
  await mkdir(path.join(code, 'sub'), { recursive: true });
  await writeFile(path.join(code, 'a.ts'), 'x');
  const past = new Date(Date.now() - 60_000);
  await utimes(path.join(code, 'a.ts'), past, past);
  const { app } = createApp({ brainsRoot: root, dataDir: path.join(root, '.workspace'), codeDir: code });
  const health = async () => (await app.request('http://127.0.0.1:4317/api/health', { headers: { host: '127.0.0.1:4317' } })).json();

  const first = await health();
  assert.equal(first.updateReady, false);
  assert.equal(typeof first.startedAt, 'string');

  await writeFile(path.join(code, 'sub', 'b.ts'), 'y');
  const future = new Date(Date.now() + 60_000);
  await utimes(path.join(code, 'sub', 'b.ts'), future, future);
  assert.equal((await health()).updateReady, true);
});
