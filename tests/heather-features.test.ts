import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApprovals } from '../src/approvals.ts';
import { createChat } from '../src/chat.ts';
import { readAliases, setAlias, defaultAvatar } from '../src/aliases.ts';
import { canOpen } from '../src/library.ts';
import { personNote, readMe, saveMe, traitsNote } from '../src/me.ts';

test('Stop ends a working brain, denies its waiting approvals, and frees it', async () => {
  const events: any[] = [];
  const emit = (e: any) => events.push(e);
  const approvals = createApprovals(emit);
  const store = { appendTranscript: async () => {}, update: async () => {} } as any;
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  const queryFn = ((args: any) => {
    const signal: AbortSignal = args.options.abortController.signal;
    return (async function* () {
      started();
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
    })();
  }) as any;
  const chat = createChat({ emit, store, approvals, queryFn } as any);
  const brain = { id: 'b1', name: 'b1', path: os.tmpdir() } as any;
  const turn = chat.runTurn({ brain, conv: { id: 'c1' } as any, text: 'go' });
  await ready;
  assert.equal(chat.isBusy('b1'), true);
  const pending = approvals.request('c1', 'Delete files', 'rm x');
  assert.equal(await chat.stop('b1'), true);
  await turn;
  assert.equal(await pending, false);
  assert.equal(chat.isBusy('b1'), false);
  assert.ok(events.some((e) => e.type === 'text' && /Stopped/.test(e.text)));
  assert.ok(!events.some((e) => e.type === 'error'));
  assert.equal(await chat.stop('b1'), false);
});

test('personality traits are saved, cleaned, and off by default', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'traits-'));
  await setAlias(dataDir, 'b', { alias: 'B', traits: ['skeptic', 'creative', 'evil'] as any });
  assert.deepEqual((await readAliases(dataDir)).b.traits, ['creative', 'skeptic']);
  await setAlias(dataDir, 'b', { alias: 'B', traits: [] });
  assert.equal((await readAliases(dataDir)).b.traits, undefined);
  assert.equal(traitsNote(undefined), '');
  assert.match(traitsNote(['skeptic']), /Skeptic/);
  assert.doesNotMatch(traitsNote(['skeptic']), /Creative/);
});

test('About you: the person owns their documents; name and folder are theirs, not hard-coded', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'me-'));
  assert.deepEqual(await readMe(dataDir), { name: '', outputFolder: '' });
  assert.doesNotMatch(personNote(await readMe(dataDir)), /Brandon|Heather/);
  await saveMe(dataDir, { name: 'Sam Lee', outputFolder: 'D:\\Out' });
  const note = personNote(await readMe(dataDir));
  assert.match(note, /Sam Lee/);
  assert.match(note, /D:\\Out/);
  assert.match(note, /file:\/\/\//);
});

test('chat links open workspace files and documents in the user folder, never programs or settings', () => {
  const root = path.resolve('/ws'), home = path.resolve('/home/u');
  assert.equal(canOpen(path.join(root, 'brain', 'deck.html'), root, home), true);
  assert.equal(canOpen(path.join(home, 'Downloads', 'a.docx'), root, home), true);
  assert.equal(canOpen(path.join(home, 'Downloads', 'notepad.exe'), root, home), false);
  assert.equal(canOpen(path.join(home, 'Downloads', 'evil.bat'), root, home), false);
  assert.equal(canOpen(path.join(home, 'Downloads', 'page.html'), root, home), false);
  assert.equal(canOpen(path.join(root, 'run.mjs'), root, home), false);
  assert.equal(canOpen(path.join(home, '.claude', 'notes.md'), root, home), false);
  assert.equal(canOpen(path.resolve('/other/a.pdf'), root, home), false);
  assert.equal(canOpen('relative/a.pdf', root, home), false);
});

test('19 colors to pick from; unstyled brains keep their automatic look', () => {
  assert.ok(['purple', 'teal', 'amber', 'pink', 'blue', 'lime'].includes(defaultAvatar('practice-brain').color));
});
