import os from 'node:os';
import path from 'node:path';

export type Decision = 'allow' | 'ask' | 'deny';
export type PolicyContext = { brainPath: string; calledIn: boolean };

const ALWAYS_ALLOW = new Set(['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite', 'Agent', 'Task', 'ToolSearch', 'Skill',
  // Small built-in helpers: stop or read a background task, ask the person a question, plan mode.
  'TaskStop', 'TaskOutput', 'BashOutput', 'KillShell', 'KillBash', 'Monitor', 'AskUserQuestion', 'EnterPlanMode', 'ExitPlanMode', 'ListAgents']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit', 'MultiEdit']);

// A command word may follow start, whitespace, ; & | ( ` $( or a path separator (/bin/rm).
const W = String.raw`(?:^|[\s;&|(\x60/\\])`;
const RISKY_BASH: [RegExp, string][] = [
  [new RegExp(`${W}git\\b[^;&|]*\\bpush\\b`), 'Push to GitHub'],
  [new RegExp(`${W}git\\b[^;&|]*\\b(reset\\s+--hard|clean\\b)`), 'Throw away local changes'],
  [new RegExp(`${W}gh\\s+pr\\s+(create|merge)\\b`), 'Open or merge a pull request'],
  [new RegExp(`${W}(rm|del|erase|rd|rmdir|ri)(\\.exe)?\\s`, 'i'), 'Delete files'],
  [/\bRemove-Item\b/i, 'Delete files'],
  [new RegExp(`${W}(pip|pip3|npm|pnpm|yarn|choco|scoop)\\s+(install|i|add)\\b`), 'Install packages'],
  [new RegExp(`${W}winget\\s+install\\b`), 'Install software'],
  [/\bcurl\b.*(-X\s*(POST|PUT|PATCH|DELETE)\b|\s(-d|--data\S*|-F|--form|-T|--upload-file)\s)/i, 'Send data to a website'],
  [/\b(Invoke-RestMethod|Invoke-WebRequest|irm|iwr)\b.*-Method\s+(Post|Put|Patch|Delete)\b/i, 'Send data to a website'],
  [/\b(Set-Content|Add-Content|Out-File|New-Item|Copy-Item|Move-Item)\b/i, 'Change files with PowerShell'],
];

// Read-only commands a called-in brain may run (spec 6.5: answer only).
const READ_ONLY_BASH = [
  /^git\s+(status|log|diff|show|branch|rev-parse|ls-files)\b/,
  /^(ls|dir|cat|type|head|tail|wc|pwd|echo|grep|rg|find|findstr|Get-ChildItem|Get-Content)\b/i,
  /^(py|python|python3)\s+engine\/tools\/(brain_status|lint_brain|build_graph|mount|screen_source)\.py\b/,
  /^node\s+engine\/tools\/brain\.mjs\s+(status|check|evals)\b/,
];

const MCP_READ = /^(get|list|search|read|query|fetch|find|describe|lookup|view|show)(_|$)/i;

/** Git Bash paths (/c/Users/x) read as Windows paths (C:/Users/x) on Windows. */
function nativePath(file: string): string {
  return process.platform === 'win32' ? file.replace(/^\/([a-zA-Z])(?=\/|$)/, '$1:') : file;
}

function inside(file: unknown, dir: string): boolean {
  if (typeof file !== 'string' || !file) return false;
  const rel = path.relative(path.resolve(dir), path.resolve(dir, nativePath(file)));
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

// Scratch space: saving or deleting here never asks.
const TEMP_DIRS = [...new Set([os.tmpdir(), process.env.TEMP, process.env.TMP].filter((d): d is string => !!d))];

/** Strictly inside the temp folder (never the temp folder itself). $TEMP, %TEMP%, ~ and /tmp are expanded. */
function inTemp(file: string): boolean {
  const f = file.replace(/^\$\{?(TEMP|TMP|TMPDIR)\}?|^\$env:(TEMP|TMP)|^%(TEMP|TMP)%/i, TEMP_DIRS[0] ?? '');
  if (/^\/tmp\/./.test(f)) return !f.includes('..');
  if (!path.isAbsolute(nativePath(f))) return false; // relative paths are in the brain, not temp
  return TEMP_DIRS.some((d) => inside(f, d) && path.resolve(d, nativePath(f)) !== path.resolve(d));
}

/** Saving here never asks: the brain, the folder that holds the brains (the workspace), and temp. */
function safeToWrite(file: unknown, brainPath: string): boolean {
  if (typeof file !== 'string' || !file) return false;
  return inside(file, brainPath) || inside(file, path.dirname(path.resolve(brainPath))) || inTemp(file);
}

// Throwaway things that are safe to delete: scratch files (named _x), temp/log/backup files, Office lock files,
// and folders that rebuild themselves. Nothing else, so real notes, decks, documents and code always ask.
const THROWAWAY_FILE = /^(_[\w.-]+|[\w.-]+\.(tmp|log|bak|pyc)|~\$.+)$/i;
const REBUILDABLE_DIR = new Set(['node_modules', '__pycache__', '.pytest_cache']);

function throwaway(file: string, brainPath: string): boolean {
  if (/[$%`*?~]/.test(file.replace(/^~\$/, '')) && !/^\*\.(tmp|log|bak|pyc)$/i.test(path.basename(file))) return false;
  if (file.split(/[\\/]/).includes('..')) return false;
  if (!safeToWrite(file, brainPath)) return false; // only inside the brain or the workspace
  const name = path.basename(file.replace(/[\\/]+$/, ''));
  return THROWAWAY_FILE.test(name) || /^\*\.(tmp|log|bak|pyc)$/i.test(name) || REBUILDABLE_DIR.has(name);
}

/** True when every delete in the command only touches temp or throwaway files. */
function deletesOnlySafe(command: string, brainPath: string): boolean {
  const dels = bashParts(command).filter((p) => /^(rm|del|erase|rd|rmdir|ri|Remove-Item)(\.exe)?\s/i.test(p));
  if (!dels.length) return false;
  return dels.every((p) => {
    const args = (p.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).slice(1).filter((a) => !a.startsWith('-') && !/^\/[a-z]$/i.test(a));
    return args.length > 0 && args.every((raw) => {
      const a = raw.replace(/^["']|["']$/g, '');
      return inTemp(a) || (!!brainPath && throwaway(a, brainPath));
    });
  });
}

/** Drops heredoc bodies and quoted text so code inside a command ("a => b", "x > 1") is not read as saving a file. */
function noHeredocs(command: string): string {
  return command.replace(/<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n\s*\2[ \t]*(?=\n|$)/g, '$3');
}
function shellOnly(command: string): string {
  return noHeredocs(command).replace(/(?<!>\s*)("(?:[^"\\]|\\.)*"|'[^']*')/g, '""');
}
// Labels checked on the shell words only, so "del" or "Out-File" inside script code or a quoted string does not count.
const SHELL_ONLY_LABELS = new Set(['Delete files', 'Change files with PowerShell']);

function bashParts(command: string): string[] {
  return command.split(/&&|\|\||;|\||\n/).map((p) => p.trim()).filter(Boolean);
}

function writesOutside(command: string, brainPath: string): boolean {
  for (const m of shellOnly(command).matchAll(/(?<![=\-<>])>>?\s*("[^"]+"|'[^']+'|[^\s=;&|)][^\s;&|)]*)/g)) {
    const target = m[1].replace(/^["']|["']$/g, '');
    if (target !== '/dev/null' && target.toLowerCase() !== 'nul' && !/^&\d$/.test(target) && !safeToWrite(target, brainPath)) return true;
  }
  return false;
}

function riskyLabel(command: string, brainPath = ''): string | null {
  for (const [re, label] of RISKY_BASH) {
    if (!re.test(SHELL_ONLY_LABELS.has(label) ? shellOnly(command) : command)) continue;
    if (label === 'Delete files' && deletesOnlySafe(noHeredocs(command), brainPath)) continue;
    return label;
  }
  if (brainPath && writesOutside(command, brainPath)) return 'Save a file outside this brain';
  return null;
}

function decideMain(tool: string, input: Record<string, unknown>, ctx: PolicyContext): Decision {
  if (ALWAYS_ALLOW.has(tool)) return 'allow';
  if (WRITE_TOOLS.has(tool)) return safeToWrite(input.file_path ?? input.notebook_path, ctx.brainPath) ? 'allow' : 'ask';
  if (tool === 'Bash' || tool === 'PowerShell') return riskyLabel(String(input.command ?? ''), ctx.brainPath) ? 'ask' : 'allow';
  if (tool === 'mcp__workspace__ask_brain') return 'allow';
  if (tool.startsWith('mcp__')) return MCP_READ.test(tool.split('__').pop() ?? '') ? 'allow' : 'ask';
  return 'ask';
}

function readOnlyCommand(command: string): boolean {
  if (/[>`]|\$\(/.test(command)) return false;
  return bashParts(command).every((part) => READ_ONLY_BASH.some((re) => re.test(part)));
}

/** Spec 6.4 and 6.5: only big actions ask; a called-in brain only answers. */
export function decide(tool: string, input: Record<string, unknown>, ctx: PolicyContext): Decision {
  if (!ctx.calledIn) return decideMain(tool, input, ctx);
  if (WRITE_TOOLS.has(tool)) return inside(input.file_path, path.join(ctx.brainPath, 'brain', 'runs')) ? 'allow' : 'deny';
  if (tool === 'Bash' || tool === 'PowerShell') return readOnlyCommand(String(input.command ?? '')) ? 'allow' : 'deny';
  if (tool === 'mcp__workspace__ask_brain') return 'deny';
  return decideMain(tool, input, ctx) === 'allow' ? 'allow' : 'deny';
}

export function describe(tool: string, input: Record<string, unknown>): { title: string; detail: string } {
  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = String(input.command ?? '');
    return { title: riskyLabel(command) ?? 'Run a command', detail: command };
  }
  if (WRITE_TOOLS.has(tool)) return { title: 'Save a file outside your workspace', detail: String(input.file_path ?? '') };
  if (tool.startsWith('mcp__')) {
    const [, server, name = ''] = tool.split('__');
    return { title: `Use ${server}: ${name.replace(/_/g, ' ')}`, detail: JSON.stringify(input, null, 2).slice(0, 2000) };
  }
  return { title: `Use ${tool}`, detail: JSON.stringify(input, null, 2).slice(0, 2000) };
}
