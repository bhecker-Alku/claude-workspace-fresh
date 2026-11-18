import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchNotes, type Brain, type Graph, type GraphNode } from '../src/brains.ts';

const brain = (id: string) => ({ id, name: id, path: '', level: '', profile: '', owner: '', blurb: '' }) as Brain;
const note = (id: string, title: string, extra: Partial<GraphNode> = {}): GraphNode =>
  ({ id, type: 'fact', title, description: '', path: `brain/${id}.md`, status: 'stable', domain: '', ...extra });
const g = (nodes: GraphNode[]): Graph => ({ nodes, edges: [] });

const graphs = [
  { brain: brain('a'), graph: g([note('a1', 'Rates for 2027'), note('a2', 'Pirate risk', { description: 'rates drift' }), note('a3', 'Rate card old', { status: 'deprecated' })]) },
  { brain: brain('b'), graph: g([note('b1', 'Rate card'), note('b2', 'Unrelated')]) },
];

test('best matches first, this brain first on ties, old notes last', () => {
  const hits = searchNotes(graphs, 'rate', 'a');
  assert.deepEqual(hits.map((h) => h.title), ['Rates for 2027', 'Rate card', 'Pirate risk', 'Rate card old']);
  assert.equal(hits[1].brainId, 'b');
  assert.equal(hits[0].path, 'brain/a1.md');
});

test('the other brain wins ties when it is the current one', () => {
  assert.deepEqual(searchNotes(graphs, 'rate', 'b').slice(0, 2).map((h) => h.title), ['Rate card', 'Rates for 2027']);
});

test('at most the limit, and nothing for one letter', () => {
  assert.equal(searchNotes(graphs, 'rate', 'a', 2).length, 2);
  assert.deepEqual(searchNotes(graphs, 'r', 'a'), []);
  assert.deepEqual(searchNotes(graphs, '  ', 'a'), []);
});
