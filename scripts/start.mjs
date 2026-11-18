// Starts Claude Workspace in the background, or opens it if it is already running.
// On the way it checks what a first run needs and says in plain words what is missing.
import { spawn } from 'node:child_process';
import { existsSync, openSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.WORKSPACE_PORT ?? 4317);
const url = `http://127.0.0.1:${port}`;
const brainsRoot = process.env.WORKSPACE_BRAINS_ROOT ?? path.dirname(root);
const say = (s) => console.log(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (p) => fetch(`${url}${p}`, { signal: AbortSignal.timeout(1500) }).then((r) => (r.ok ? r.json() : null), () => null);
const openBrowser = () => {
  if (process.env.WORKSPACE_NO_OPEN) return;
  const cmd = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
};

// 1. Node.js
const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  say(`Claude Workspace needs Node.js 22 or newer. This computer has ${process.versions.node}.`);
  say('Install the current Node.js from nodejs.org (or your company software portal), then start again.');
  process.exit(1);
}

// Already running: just open it.
if (await get('/api/brains')) {
  openBrowser();
  say(`Claude Workspace is already running at ${url}`);
  process.exit(0);
}

// 2. Packages, once
if (!existsSync(path.join(root, 'node_modules'))) {
  say('First run: installing (one time, a few minutes)...');
  const code = await new Promise((res) => spawn('npm install --omit=dev --no-fund --no-audit', { cwd: root, stdio: 'inherit', shell: true }).on('exit', res));
  if (code) { say('The install failed. Check your internet connection and start again.'); process.exit(1); }
}

// 3. Brains next to this folder
const brains = (() => {
  try { return readdirSync(brainsRoot, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(path.join(brainsRoot, d.name, 'brain.yaml'))).length; } catch { return 0; }
})();
say(brains
  ? `Found ${brains} brain${brains === 1 ? '' : 's'} in ${brainsRoot}.`
  : `No brains found in ${brainsRoot}. Put your brain folders there, or use "Brain or project" in the sidebar.`);

// 4. Start, then check the Claude sign-in
const log = openSync(path.join(root, '.workspace-server.log'), 'a');
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'] /* one process, so Windows opens no console window */, {
  cwd: root, detached: true, stdio: ['ignore', log, log], windowsHide: true,
  env: { ...process.env, WORKSPACE_NO_OPEN: '1' },
}).unref();
say('Starting...');
let up = false;
for (let i = 0; i < 60 && !up; i++) { await wait(500); up = Boolean(await get('/api/brains')); }
if (!up) { say(`Claude Workspace did not start. Details are in ${path.join(root, '.workspace-server.log')}.`); process.exit(1); }

const session = await fetch(`${url}/api/session`, { signal: AbortSignal.timeout(30_000) }).then((r) => r.json(), () => null);
if (session?.ok) say(`Signed in to Claude as ${session.account}.`);
else {
  say('Claude Code is not signed in with a Claude subscription on this computer.');
  say('Open Claude Code, sign in once, then press "Try again" in Claude Workspace.');
}
openBrowser();
say(`Claude Workspace is running at ${url}. It keeps running in the background until you hold the ⏻ in the top bar.`);
