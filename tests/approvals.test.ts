import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovals } from '../src/approvals.ts';
import type { WorkspaceEvent } from '../src/events.ts';

test('request emits a card and resolves with the answer', async () => {
  const events: WorkspaceEvent[] = [];
  const a = createApprovals((e) => events.push(e));
  const p = a.request('c1', 'Push to GitHub', 'git push');
  const card = events[0] as Extract<WorkspaceEvent, { type: 'approval' }>;
  assert.equal(card.type, 'approval');
  assert.equal(a.resolve(card.id, true), true);
  assert.equal(await p, true);
  assert.equal(events[1].type, 'approval-resolved');
  assert.equal(a.resolve(card.id, true), false);
});

test('approval times out as deny', async () => {
  const a = createApprovals(() => {});
  assert.equal(await a.request('c1', 't', 'd', 30), false);
});
