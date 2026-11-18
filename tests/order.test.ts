import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readOrder, saveOrder, sortByOrder } from '../src/groups.ts';

test('the sidebar order is remembered', async () => {
  const d = await mkdtemp(path.join(os.tmpdir(), 'order-'));
  assert.deepEqual(await readOrder(d), []);
  await saveOrder(d, ['b', 'a', 'b', 7 as any, 'c']);
  assert.deepEqual(await readOrder(d), ['b', 'a', 'c']);
});

test('brains follow the saved order; new ones go last in their usual order', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'new1' }, { id: 'c' }, { id: 'new2' }];
  assert.deepEqual(sortByOrder(list, ['c', 'a', 'b']).map((x) => x.id), ['c', 'a', 'b', 'new1', 'new2']);
  assert.deepEqual(sortByOrder(list, []).map((x) => x.id), ['a', 'b', 'new1', 'c', 'new2']);
});
