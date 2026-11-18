import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { decide, describe } from '../src/policy.ts';

const brainPath = path.resolve('/tmp/practice-brain');
const ctx = { brainPath, calledIn: false };
const called = { brainPath, calledIn: true };
const bash = (command: string, c = ctx) => decide('Bash', { command }, c);

test('reads and research are allowed', () => {
  for (const t of ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite', 'Agent', 'Task']) assert.equal(decide(t, {}, ctx), 'allow', t);
});
test('writes inside the brain, the workspace or temp are allowed, elsewhere ask', () => {
  assert.equal(decide('Write', { file_path: path.join(brainPath, 'brain/notes/x.md') }, ctx), 'allow');
  assert.equal(decide('Edit', { file_path: path.join(brainPath, '..', 'other', 'x.md') }, ctx), 'allow');
  assert.equal(decide('Write', { file_path: path.join(os.tmpdir(), 'claude', 'x.py') }, ctx), 'allow');
  assert.equal(decide('Edit', { file_path: path.resolve('/elsewhere/settings.json') }, ctx), 'ask');
});
test('deleting only in temp is allowed; real deletes still ask', () => {
  assert.equal(bash('py engine/tools/lint_brain.py; rm -rf "$TEMP/sample_build"; ls brain/inbox'), 'allow');
  assert.equal(bash(`rm -f ${path.join(os.tmpdir(), 'x.txt')}`), 'allow');
  assert.equal(bash('rm -rf /tmp/deckshots'), 'allow');
  assert.equal(bash('rm -rf "$TEMP"'), 'ask');
  assert.equal(bash('rm -rf "$TEMP/../x"'), 'ask');
  assert.equal(bash('rm -rf "$TEMP/a" brain/notes'), 'ask');
  assert.equal(bash('rm -f notes.md'), 'ask');
});
test('throwaway deletes are allowed; real files and folders still ask', () => {
  for (const c of ['rm -f _cs.ts', 'rm -rf node_modules', 'rm -rf engine/tools/__pycache__', 'rm -f build.log *.tmp', 'del "~$Proposal.docx"'])
    assert.equal(bash(c), 'allow', c);
  for (const c of ['rm -f brain/deliverables/deck_v2.html', 'rm -rf brain', 'rm -rf src', 'rm -f *.html', 'rm -rf /elsewhere/node_modules', 'rm -f ../../_x.ts', 'rm -f $D/_x.ts', 'rm -f _x.ts notes.md'])
    assert.equal(bash(c), 'ask', c);
});
test('code inside a command is not read as saving a file', () => {
  assert.equal(bash("python - <<'EOF'\nif a > b: print(x)\nf = lambda: 1 >= 2\nEOF"), 'allow');
  assert.equal(bash("node -e \"const f = (x) => x > 1\""), 'allow');
  assert.equal(bash("py - <<'EOF'\nd = {}\ndel d['a']\nEOF"), 'allow');
  assert.equal(bash("grep -n ' del ' notes.md"), 'allow');
  assert.equal(bash('echo hi > /elsewhere/out.txt'), 'ask');
  assert.equal(bash("cat > /elsewhere/out.txt <<'EOF'\nhi\nEOF"), 'ask');
});
test('small built-in tools do not ask', () => {
  for (const t of ['TaskStop', 'AskUserQuestion', 'Monitor']) assert.equal(decide(t, {}, ctx), 'allow', t);
});
test('risky bash asks, ordinary bash allowed', () => {
  assert.equal(bash('py engine/tools/lint_brain.py'), 'allow');
  assert.equal(bash('git commit -m x'), 'allow');
  for (const c of ['git push origin main', 'gh pr create --fill', 'gh pr merge 3', 'rm -rf x', 'del x', 'Remove-Item x', 'pip install y', 'npm install z', 'winget install q', 'curl -X POST https://x'])
    assert.equal(bash(c), 'ask', c);
});
test('chained git status && git push asks', () => {
  assert.equal(bash('git status && git push'), 'ask');
  assert.equal(bash('git status; ls | grep x'), 'allow');
});
test('mcp tools: ask_brain allowed, sending asks, reads allowed, unknown tool asks', () => {
  assert.equal(decide('mcp__workspace__ask_brain', {}, ctx), 'allow');
  assert.equal(decide('mcp__slack__post_message', {}, ctx), 'ask');
  assert.equal(decide('mcp__gmail__search_threads', {}, ctx), 'allow');
  assert.equal(decide('SomethingNew', {}, ctx), 'ask');
});
test('called-in brain cannot write notes, push or commit', () => {
  assert.equal(decide('Write', { file_path: path.join(brainPath, 'brain/domains/x.md') }, called), 'deny');
  assert.equal(decide('Write', { file_path: path.join(brainPath, 'brain/runs/r.json') }, called), 'allow');
  assert.equal(bash('git push', called), 'deny');
  assert.equal(bash('git commit -m x', called), 'deny');
  assert.equal(decide('Read', {}, called), 'allow');
});
test('describe gives plain words', () => {
  assert.equal(describe('Bash', { command: 'git push origin main' }).title, 'Push to GitHub');
  assert.equal(describe('Bash', { command: 'git push origin main' }).detail, 'git push origin main');
});
