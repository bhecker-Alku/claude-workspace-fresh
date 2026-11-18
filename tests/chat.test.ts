import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createChat, BusyError } from '../src/chat.ts';
import { createApprovals } from '../src/approvals.ts';
import { createStore } from '../src/store.ts';
import type { WorkspaceEvent } from '../src/events.ts';
import type { Brain } from '../src/brains.ts';

const brain: Brain = { id: 'practice-brain', name: 'acme-practice', path: path.resolve('/tmp/practice-brain'), level: '', profile: '', owner: '', blurb: '' };

async function setup(script: (options: any) => AsyncGenerator<any>) {
  const events: WorkspaceEvent[] = [];
  const emit = (e: WorkspaceEvent) => events.push(e);
  const store = createStore(await mkdtemp(path.join(os.tmpdir(), 'workspace-chat-')));
  const approvals = createApprovals(emit);
  const chat = createChat({ store, approvals, emit, queryFn: ((p: any) => script(p.options)) as any });
  const conv = await store.create(brain.id, 'x');
  return { events, store, approvals, chat, conv };
}

test('emits text and done and saves sessionId', async () => {
  const { events, store, chat, conv } = await setup(async function* () {
    yield { type: 'system', subtype: 'init', session_id: 'sess-9' };
    yield { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'a.md' } }, { type: 'text', text: 'Hello' }] } };
    yield { type: 'result', subtype: 'success', session_id: 'sess-9' };
  });
  await chat.runTurn({ brain, conv, text: 'hi' });
  assert.deepEqual(events.map((e) => e.type), ['step', 'step', 'text', 'done']);
  assert.equal((await store.get(conv.id))?.sessionId, 'sess-9');
  assert.deepEqual((await store.readTranscript(conv.id))[0], { type: 'user', text: 'hi' });
});

test('ask tool waits for approval then continues', async () => {
  let decision: any;
  const { events, approvals, chat, conv } = await setup(async function* (options) {
    decision = await options.hooks.PreToolUse[0].hooks[0]({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git push' } }, 'id', { signal: new AbortController().signal });
    yield { type: 'result', subtype: 'success', session_id: 's' };
  });
  const turn = chat.runTurn({ brain, conv, text: 'push it' });
  await new Promise((r) => setTimeout(r, 20));
  const card = events.find((e) => e.type === 'approval') as Extract<WorkspaceEvent, { type: 'approval' }>;
  assert.equal(card.title, 'Push to GitHub');
  approvals.resolve(card.id, true);
  await turn;
  assert.equal(decision.hookSpecificOutput.permissionDecision, 'allow');
});

test('second turn on busy brain throws BusyError', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { chat, conv } = await setup(async function* () {
    await gate;
    yield { type: 'result', subtype: 'success', session_id: 's' };
  });
  const first = chat.runTurn({ brain, conv, text: 'a' });
  assert.equal(chat.isBusy(brain.id), true);
  await assert.rejects(chat.runTurn({ brain, conv, text: 'b' }), BusyError);
  release();
  await first;
  assert.equal(chat.isBusy(brain.id), false);
});

test('done is sent only after the brain is free again', async () => {
  let busyAtDone: boolean | null = null;
  const events: WorkspaceEvent[] = [];
  const store = createStore(await mkdtemp(path.join(os.tmpdir(), 'workspace-done-')));
  const chat: any = createChat({
    store, approvals: createApprovals(() => {}),
    emit: (e) => { events.push(e); if (e.type === 'done') busyAtDone = chat.isBusy(brain.id); },
    queryFn: (() => (async function* () {
      yield { type: 'result', subtype: 'success', session_id: 's' };
      await new Promise((r) => setTimeout(r, 20));
    })()) as any,
  });
  await chat.runTurn({ brain, conv: await store.create(brain.id, 'x'), text: 'hi' });
  assert.equal(busyAtDone, false);
  assert.equal(events.filter((e) => e.type === 'done').length, 1);
});

test('a step is shown as soon as the turn starts', async () => {
  const { events, chat, conv } = await setup(async function* () {
    yield { type: 'result', subtype: 'success', session_id: 's' };
  });
  await chat.runTurn({ brain, conv, text: 'hi' });
  assert.equal(events[0].type, 'step');
});
