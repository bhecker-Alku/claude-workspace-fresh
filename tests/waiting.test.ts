import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWaiting, plainTitle } from '../src/brains.ts';

const out = `Brain status, 2026-11-17, for human:sam
Feedback not closed: 1 items, oldest 15 days
  Waiting on human:sam: 1
      15d  correction open     2026-11-02-workshop-board-too-much-live-data-entry
    age unknown  unlabeled open     no-date-item  a note
Checkpoints awaiting a person: 1
    2026-10-27-initial-ingest-acme  checkpoint: awaiting human:sam
`;

test('status output becomes plain items waiting on one person', () => {
  assert.deepEqual(parseWaiting(out), [
    { kind: 'correction', age: 15, title: 'Workshop board too much live data entry', note: '' },
    { kind: 'unlabeled', age: null, title: 'No date item', note: 'a note' },
    { kind: 'checkpoint', age: null, title: 'Initial ingest acme', note: '' },
  ]);
});

test('nothing waiting gives an empty list', () => {
  assert.deepEqual(parseWaiting('Brain status, 2026-11-17, for human:x\nFeedback not closed: none\nCheckpoints awaiting a person: 0\n'), []);
});

test('file names read as plain titles', () => {
  assert.equal(plainTitle('2026-10-27-no-volume-test-no-code-risk'), 'No volume test no code risk');
});
