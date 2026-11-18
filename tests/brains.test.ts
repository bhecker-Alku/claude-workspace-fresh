import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverBrains } from '../src/brains.ts';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'workspace-'));
  const mk = async (dir: string, yaml?: string, start?: string) => {
    await mkdir(path.join(root, dir));
    if (yaml !== undefined) await writeFile(path.join(root, dir, 'brain.yaml'), yaml);
    if (start) await writeFile(path.join(root, dir, 'START-HERE.md'), start);
  };
  await mk('zeta-brain', 'brain: zeta\nlevel: project\nprofile: standard-delivery\nowner: human:sam\n');
  await mk('alpha-brain', 'brain: alpha\nlevel: practice\nprofile: shareable-knowledge\nowner: human:sam\n',
    '# Start\n\n## What this brain is\nThe alpha practice brain.\n\n## Read in this order\n1. x\n');
  await mk('plain-folder');
  await mk('broken-brain', 'brain: [unclosed\n  : :');
  return root;
}

test('finds folders with brain.yaml, sorted by name', async () => {
  const brains = await discoverBrains(await fixture());
  assert.deepEqual(brains.map((b) => b.name), ['alpha', 'zeta']);
  assert.equal(brains[0].id, 'alpha-brain');
  assert.equal(brains[0].level, 'practice');
});

test('reads blurb from START-HERE', async () => {
  const [alpha, zeta] = await discoverBrains(await fixture());
  assert.equal(alpha.blurb, 'The alpha practice brain.');
  assert.equal(zeta.blurb, '');
});

test('skips malformed brain.yaml', async () => {
  const brains = await discoverBrains(await fixture());
  assert.ok(!brains.some((b) => b.id === 'broken-brain'));
});
