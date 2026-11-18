import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readCheckpoints, type Brain } from '../src/brains.ts';
import { nextSteps } from '../public/next-steps.js';

async function brainWithRuns(runs: Record<string, string>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cp-'));
  await mkdir(path.join(dir, 'brain', 'runs'), { recursive: true });
  for (const [name, body] of Object.entries(runs)) await writeFile(path.join(dir, 'brain', 'runs', name), body);
  return { id: 'b', name: 'b', path: dir, level: '', profile: '', owner: '', blurb: '' } as Brain;
}

test('checkpoints waiting on one person, read from run records', async () => {
  const b = await brainWithRuns({
    'a.json': JSON.stringify({ checkpoint: { status: 'awaiting human:sam', words: 'confirm rates, then send the SOW' } }),
    'b.json': JSON.stringify({ checkpoint_scope: { status: 'done' } }),
    'c.json': '{ not json',
    'd.json': JSON.stringify({ steps: [{ step: 'draft', status: 'ok' }, { step: 'review', status: 'awaiting human:sam' }] }),
  });
  assert.deepEqual(await readCheckpoints(b, 'human:sam'), [
    { run: 'a', step: 'checkpoint', words: 'confirm rates, then send the SOW' },
    { run: 'd', step: 'steps[-1] review', words: '' },
  ]);
  assert.deepEqual(await readCheckpoints(b, 'human:erin'), []);
});

test('name matching ignores capitals and never matches part of a longer name', async () => {
  const b = await brainWithRuns({
    'a.json': JSON.stringify({ checkpoint: { status: 'Awaiting human:Sam', words: 'ok' } }),
    'b.json': JSON.stringify({ checkpoint: { status: 'awaiting human:samantha', words: 'other' } }),
  });
  assert.deepEqual((await readCheckpoints(b, 'human:sam')).map((c) => c.run), ['a']);
});

test('a brain with no runs folder has no checkpoints', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cp-'));
  assert.deepEqual(await readCheckpoints({ id: 'x', name: 'x', path: dir } as Brain, 'human:sam'), []);
});

test('each answer says what happens next', () => {
  assert.deepEqual(nextSteps('confirm rates, then send the SOW'), { yes: 'The brain will send the SOW.', no: 'The brain will hold off and ask what to change.' });
  assert.deepEqual(nextSteps('is this right'), { yes: 'Tell the brain yes.', no: 'Tell the brain no.' });
  assert.deepEqual(nextSteps('Is the plan then final?'), { yes: 'Tell the brain yes.', no: 'Tell the brain no.' });
  assert.equal(nextSteps('check the dates, then send it?').yes, 'The brain will send it.');
});
