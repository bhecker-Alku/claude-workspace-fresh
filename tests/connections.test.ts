import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { blockedTools, labelOf, readDisabled, readStatus, setEnabled, toolPrefix } from '../src/connections.ts';

test('names read plainly and match Claude Code tool prefixes', () => {
  assert.equal(labelOf('claude.ai Microsoft 365'), 'Microsoft 365');
  assert.equal(labelOf('plugin:vercel:vercel'), 'Vercel');
  assert.equal(toolPrefix('claude.ai Microsoft 365'), 'mcp__claude_ai_Microsoft_365');
});

test('switching a connection off blocks its tools; on again unblocks', async () => {
  const d = await mkdtemp(path.join(os.tmpdir(), 'ws-conn-'));
  assert.deepEqual(await readDisabled(d), []);
  await setEnabled(d, 'claude.ai Slack', false);
  assert.deepEqual(await blockedTools(d), ['mcp__claude_ai_Slack']);
  await setEnabled(d, 'claude.ai Slack', true);
  assert.deepEqual(await blockedTools(d), []);
});

test('status is read from a session that never sends a message, and the session is stopped', async () => {
  let stopped = false;
  const fake: any = () => ({
    mcpServerStatus: async () => [{ name: 'claude.ai Slack', status: 'connected', source: 'claudeai', tools: [{ name: 'a' }, { name: 'b' }] }, { name: 'claude.ai Gmail', status: 'needs-auth', source: 'claudeai' }],
    supportedCommands: async () => [{ name: 'acme-report:acme-report', description: '(acme-report) Make a RAID log' }, { name: 'pdf', description: 'PDFs' }, { name: 'help', description: 'x', builtin: true }],
    interrupt: async () => { stopped = true; },
  });
  const { connections: list, skills } = await readStatus('.', fake);
  assert.deepEqual(skills.map((x) => [x.group, x.label, x.description]), [['acme-report', 'acme-report', 'Make a RAID log'], ['Your skills', 'pdf', 'PDFs']]);
  assert.deepEqual(list.map((c) => [c.label, c.status, c.tools, c.scope]), [['Slack', 'connected', 2, 'claudeai'], ['Gmail', 'needs-auth', 0, 'claudeai']]);
  assert.ok(stopped);
});

test('a brain keeps the skills and apps switched off for it', async () => {
  const d = await mkdtemp(path.join(os.tmpdir(), 'ws-off-'));
  const { setAlias, readAliases } = await import('../src/aliases.ts');
  await setAlias(d, 'b', { alias: 'Bo', skillsOff: ['x:deck', 'x:deck', 7 as any], appsOff: ['claude.ai Slack'] });
  let a = (await readAliases(d)).b;
  assert.deepEqual([a.skillsOff, a.appsOff], [['x:deck'], ['claude.ai Slack']]);
  await setAlias(d, 'b', { alias: 'Bo2' });
  a = (await readAliases(d)).b;
  assert.deepEqual(a.skillsOff, ['x:deck']);
  await setAlias(d, 'b', { alias: 'Bo2', skillsOff: [] });
  assert.equal((await readAliases(d)).b.skillsOff, undefined);
});
