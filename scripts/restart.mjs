// Started by the server's Restart button: waits for the old server to let go of the port, then starts a fresh one.
import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.WORKSPACE_PORT ?? 4317);
const url = `http://127.0.0.1:${port}/api/brains`;
const answering = () => fetch(url, { signal: AbortSignal.timeout(800) }).then(() => true, () => false);

const deadline = Date.now() + 15_000;
while (await answering()) {
  // The old server never let go: leave it running rather than start a second one that cannot get the port.
  if (Date.now() > deadline) process.exit(1);
  await new Promise((r) => setTimeout(r, 300));
}

const log = openSync(path.join(root, '.workspace-server.log'), 'a');
const tsx = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'] /* one process, so Windows opens no console window */, {
  cwd: root, detached: true, stdio: ['ignore', log, log], windowsHide: true,
  env: { ...process.env, WORKSPACE_NO_OPEN: '1' },
}).unref();
