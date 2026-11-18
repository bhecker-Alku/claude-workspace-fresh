import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { allBrains, brainStatus, readCheckpoints, readGraph } from '../src/brains.ts';

const starter = path.resolve('starter-brain');

test('the starter brain is found, draws a graph, and reports what waits on someone without Python', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ws-starter-'));
  const dir = path.join(root, 'my-brain');
  await cp(starter, dir, { recursive: true });
  const tool = path.join(dir, 'engine', 'tools', 'brain.mjs');
  const run = (...a: string[]) => execFileSync(process.execPath, [tool, ...a], { cwd: dir, encoding: 'utf8' });

  // Engine: a new domain and note, then a healthy refresh.
  run('new-domain', 'Funders', 'Who funds what.');
  run('new-note', 'funders', 'nsf', 'National Science Foundation', 'organization');
  assert.match(run('refresh'), /HEALTHY/);

  // Something waiting on Dana: open feedback and a checkpoint.
  await writeFile(path.join(dir, 'brain', 'feedback', '2026-11-01-budget-question.md'),
    '---\ntype: feedback\ntitle: Budget question\ndescription: Confirm the travel budget cap\nstatus: open\nwho: dana\n---\n# Budget question\n');
  const id = run('run', 'new', 'email', 'send an email').trim();
  run('run', 'step', id, 'drafted', '--await', 'dana', 'Send it?');

  const [brain] = await allBrains(root, path.join(root, '.data'));
  assert.equal(brain.name, 'my-brain');
  assert.match(brain.blurb, /not set up yet/);

  const graph = await readGraph(brain);
  assert.ok(graph.nodes.some((n) => n.id === 'notes/funders/nsf' && n.domain === 'funders'));
  assert.ok(graph.edges.some((e) => [e.source, e.target].includes('notes/funders/nsf')));

  const waiting = await brainStatus(brain, 'dana');
  assert.ok(waiting.some((w) => w.kind === 'feedback' && /budget question/i.test(w.title)), JSON.stringify(waiting));
  assert.ok(waiting.some((w) => w.kind === 'checkpoint'), JSON.stringify(waiting));
  assert.equal((await readCheckpoints(brain, 'dana')).length, 1);
  assert.deepEqual(await brainStatus(brain, 'sam').then((w) => w.filter((x) => x.kind === 'feedback')), []);
});

test('typed notes fill the registers, links keep their meaning, and usage teaches the memory paths', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ws-learn-'));
  const dir = path.join(root, 'b');
  await cp(starter, dir, { recursive: true });
  const tool = path.join(dir, 'engine', 'tools', 'brain.mjs');
  const run = (...a: string[]) => execFileSync(process.execPath, [tool, ...a], { cwd: dir, encoding: 'utf8' });
  run('new-domain', 'Work', 'Our work.');
  const note = (slug: string, type: string, fields: string, desc: string) =>
    writeFile(path.join(dir, 'brain', 'notes', 'work', `${slug}.md`), `---\ntype: ${type}\ntitle: ${slug}\ndescription: ${desc}\ndomain: work\nstatus: active\n${fields}---\n# ${slug}\n\nRelated: [[_hub]]\n\nSources: chat\n`);
  await note('ana', 'person', 'role: lead\nprojects: [launch]\n', 'Leads the launch.');
  await note('launch', 'project', 'owner: ana\nrisks: [delay]\ndecisions: [go-live]\n', 'The product launch.');
  await note('delay', 'risk', 'severity: high\nowner: ana\nprojects: [launch]\n', 'Supplier may be late.');
  await note('go-live', 'decision', 'date: 2026-11-01\ndecided_by: ana\nprojects: [launch]\n', 'Launch on Dec 1.');
  await note('sla', 'term', 'aka: [service level agreement]\n', 'Promised response time.');
  assert.match(run('refresh'), /HEALTHY/);

  const reg = async (f: string) => (await import('node:fs/promises')).readFile(path.join(dir, 'brain', 'registers', `${f}.md`), 'utf8');
  assert.match(await reg('risks'), /\[delay\].*\| high \|/);
  assert.match(await reg('decisions'), /\[go-live\].*2026-11-01/);
  assert.match(await reg('glossary'), /\[sla\].*service level agreement/);

  const graph = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(dir, 'brain', 'graph.json'), 'utf8'));
  const kinds = new Set(graph.edges.map((e: any) => e.kind));
  for (const k of ['part-of', 'decided-by', 'owned-by']) assert.ok(kinds.has(k), `edge kind ${k}`);

  // Two questions answered by the same two unlinked notes, one found only by searching.
  run('used', 'sla', 'ana', '--q', 'who handles the SLA?', '--searched');
  run('used', 'brain/notes/work/sla.md', 'ana', '--q', 'SLA owner?');
  const learned = run('learn');
  assert.match(learned, /2x\s+notes\/work\/ana/);
  assert.match(learned, /notes\/work\/ana\s+<->\s+notes\/work\/sla/);
  assert.match(learned, /"who handles the SLA\?"/);
  run('refresh');
  const g2 = JSON.parse(await (await import('node:fs/promises')).readFile(path.join(dir, 'brain', 'graph.json'), 'utf8'));
  assert.equal(g2.nodes.find((n: any) => n.id === 'notes/work/sla').uses, 2);
});

test('upkeep runs from hooks: the turn is recorded, the graph rebuilt, and broken links sent back once', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ws-hooks-'));
  const dir = path.join(root, 'b');
  await cp(starter, dir, { recursive: true });
  const tool = path.join(dir, 'engine', 'tools', 'brain.mjs');
  const run = (...a: string[]) => execFileSync(process.execPath, [tool, ...a], { cwd: dir, encoding: 'utf8' });
  const hook = (event: string, input: object) => execFileSync(process.execPath, [tool, 'hook', event], { cwd: dir, encoding: 'utf8', input: JSON.stringify(input) });
  run('new-domain', 'Work', 'x');
  await writeFile(path.join(dir, 'brain', 'notes', 'work', 'budget.md'), '---\ntype: fact\ntitle: Budget\ndescription: 2000 dollars.\ndomain: work\nstatus: active\n---\n# Budget\n\nSources: chat\n');
  run('refresh');
  const fs = await import('node:fs/promises');
  hook('prompt', { session_id: 's', prompt: '[Claude Workspace display note, from the app]\n\nwhat is the budget?' });
  hook('tool', { session_id: 's', tool_name: 'Read', tool_input: { file_path: path.join(dir, 'brain', 'notes', 'work', 'budget.md') } });
  assert.equal(hook('stop', { session_id: 's' }), '');
  const ledger = (await fs.readFile(path.join(dir, 'brain', 'ledger.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual([ledger[0].q, ledger[0].notes, ledger[0].searched], ['what is the budget?', ['notes/work/budget'], false]);

  await fs.appendFile(path.join(dir, 'brain', 'notes', 'work', 'budget.md'), '\nSee [[missing-note]].\n');
  hook('prompt', { session_id: 's', prompt: 'x' });
  assert.match(hook('stop', { session_id: 's' }), /"decision":"block".*missing-note/);
  assert.equal(hook('stop', { session_id: 's', stop_hook_active: true }), '');
  assert.ok((await fs.readFile(path.join(dir, 'brain', 'graph.json'), 'utf8')).includes('notes/work/budget'));
});

test('New brain: the app unzips the template into a named folder that shows up as a brain', async () => {
  const { createApp } = await import('../src/server.ts');
  const root = await mkdtemp(path.join(os.tmpdir(), 'ws-new-'));
  const { app } = createApp({ brainsRoot: root, dataDir: path.join(root, '.data') });
  const post = (name: string) => app.request('/api/brains/new', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:4317', host: '127.0.0.1:4317' }, body: JSON.stringify({ name }) });
  const r = await post('Grant Writer');
  const body = await r.json();
  assert.equal(r.status, 200, JSON.stringify(body));
  assert.equal(body.id, 'grant-writer');
  const [b] = await allBrains(root, path.join(root, '.data'));
  assert.equal(b.name, 'grant-writer');
  assert.match(b.blurb, /not set up yet/);
  assert.equal((await post('grant writer')).status, 400);
  assert.equal((await post('   ')).status, 400);
});
