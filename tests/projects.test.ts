import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listFolders } from '../src/folders.ts';
import { addFolder, allBrains } from '../src/brains.ts';
import { claudeProjectDir, listClaudeSessions, readClaudeSession } from '../src/sessions.ts';
import { buildPrompt } from '../src/chat.ts';

async function tree() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'ws-proj-'));
  await mkdir(path.join(base, 'a-brain'));
  await writeFile(path.join(base, 'a-brain', 'brain.yaml'), 'brain: alpha\n');
  await mkdir(path.join(base, 'code'));
  await mkdir(path.join(base, '.hidden'));
  await writeFile(path.join(base, 'file.txt'), 'x');
  return base;
}

test('listFolders shows subfolders, marks brains, hides dot folders and files', async () => {
  const base = await tree();
  const r = await listFolders(base);
  assert.equal(r.path, path.resolve(base));
  assert.equal(r.parent, path.dirname(path.resolve(base)));
  assert.deepEqual(r.folders.map((f) => [f.name, f.isBrain]), [['a-brain', true], ['code', false]]);
});

test('listFolders on a missing path falls back to the home folder', async () => {
  const r = await listFolders(path.join(os.tmpdir(), 'does-not-exist-ws'));
  assert.equal(r.path, os.homedir());
});

test('a plain folder is added as a project', async () => {
  const base = await tree();
  const dataDir = path.join(base, 'data');
  const p = await addFolder(dataDir, path.join(base, 'code'));
  assert.equal(p.kind, 'project');
  assert.equal(p.name, 'code');
  const all = await allBrains(path.join(base, 'nowhere'), dataDir);
  assert.deepEqual(all.map((b) => [b.name, b.kind]), [['code', 'project']]);
});

test('claudeProjectDir encodes the folder like Claude Code does', () => {
  assert.equal(path.basename(claudeProjectDir('C:\\Users\\sam\\brains', '/home/x')), 'C--Users-sam-brains');
});

test('Claude Code sessions are listed newest first with a title, and read back as chat items', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'ws-home-'));
  const dir = claudeProjectDir('C:\\work', home);
  await mkdir(dir, { recursive: true });
  const lines = [
    { type: 'user', isMeta: true, message: { role: 'user', content: '<local-command-caveat>x</local-command-caveat>' } },
    { type: 'user', message: { role: 'user', content: 'Build me an app' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'On it.' }, { type: 'tool_use', name: 'Bash', input: {} }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'Thanks' }] } },
  ];
  await writeFile(path.join(dir, 'sess-1.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n'));
  const sessions = await listClaudeSessions('C:\\work', home);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, 'sess-1');
  assert.equal(sessions[0].title, 'Build me an app');
  const items = await readClaudeSession('C:\\work', 'sess-1', home);
  assert.deepEqual(items, [{ type: 'user', text: 'Build me an app' }, { type: 'text', text: 'On it.' }, { type: 'user', text: 'Thanks' }]);
});

test('readClaudeSession refuses ids with path parts', async () => {
  await assert.rejects(readClaudeSession('C:\\work', '..\\..\\secret', os.tmpdir()), /bad-session/);
});

test('buildPrompt sends plain text, or one user message with images then text', async () => {
  assert.equal(buildPrompt('hi', []), 'hi');
  const prompt = buildPrompt('look', [{ mediaType: 'image/png', data: 'AAAA' }]);
  assert.notEqual(typeof prompt, 'string');
  const msgs = [];
  for await (const m of prompt as AsyncIterable<any>) msgs.push(m);
  assert.equal(msgs.length, 1);
  assert.deepEqual(msgs[0].message.content, [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
    { type: 'text', text: 'look' },
  ]);
});
