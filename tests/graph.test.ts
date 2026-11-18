import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readGraph, type Brain } from '../src/brains.ts';

const brainAt = (p: string) => ({ id: 'b', name: 'b', path: p, level: '', profile: '', owner: '', blurb: '' }) as Brain;

test('graph keeps real links once and drops dangling ones', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'graph-'));
  await mkdir(path.join(dir, 'brain'));
  await writeFile(path.join(dir, 'brain', 'graph.json'), JSON.stringify({
    nodes: [{ id: 'a', type: 'fact', title: 'A', path: '/brain/a.md' }, { id: 'b', type: 'risk' }],
    edges: [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }, { source: 'a', target: 'gone' }, { source: 'a', target: 'a' }],
  }));
  const g = await readGraph(brainAt(dir));
  assert.equal(g.nodes.length, 2);
  assert.equal(g.nodes[0].path, 'brain/a.md');
  assert.equal(g.nodes[1].title, 'b');
  assert.deepEqual(g.edges, [{ source: 'a', target: 'b' }]);
});

test('a brain with no graph gives an empty map', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'graph-'));
  assert.deepEqual(await readGraph(brainAt(dir)), { nodes: [], edges: [] });
});
