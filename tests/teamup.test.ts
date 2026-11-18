import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseMentions, askBrain } from '../src/teamup.ts';
import type { Brain } from '../src/brains.ts';

const b = (id: string, name: string): Brain => ({ id, name, path: path.resolve('/tmp', id), level: '', profile: '', owner: '', blurb: '' });
const brains = [b('practice-brain', 'acme-practice'), b('engineering-brain', 'acme-engineering')];

test('parses @practice-brain and @acme-engineering', () => {
  const r = parseMentions('@practice-brain and @ACME-Engineering what platforms?', brains);
  assert.deepEqual(r.brainIds, ['practice-brain', 'engineering-brain']);
  assert.equal(r.rest, 'and what platforms?');
});

test('ignores unknown mentions and emails', () => {
  const r = parseMentions('mail bob@practice-brain.com or @nobody', brains);
  assert.deepEqual(r.brainIds, []);
});

const fake = (answer: string, onOptions?: (o: any) => Promise<void>) => ((p: any) => (async function* () {
  if (onOptions) await onOptions(p.options);
  yield { type: 'result', subtype: 'success', result: answer, session_id: 's' };
})()) as any;

test('askBrain returns the answer and marks needsConfirmation', async () => {
  const r = await askBrain({ from: brains[0], to: brains[1], question: 'q', queryFn: fake('NEEDS CONFIRMATION: the rate') });
  assert.equal(r.needsConfirmation, true);
  assert.equal(r.answer, 'NEEDS CONFIRMATION: the rate');
});

test('askBrain denies push and gives no team-up tool', async () => {
  let decision: any, servers: any;
  await askBrain({ from: brains[0], to: brains[1], question: 'q', queryFn: fake('ok', async (o) => {
    servers = o.mcpServers;
    decision = await o.canUseTool('Bash', { command: 'git push' }, { signal: new AbortController().signal });
  }) });
  assert.equal(decision.behavior, 'deny');
  assert.equal(servers, undefined);
});
