// Stops the background Claude Workspace server. Works on Windows and Mac.
import { execSync } from 'node:child_process';

const port = Number(process.env.WORKSPACE_PORT ?? 4317);
const find = process.platform === 'win32'
  ? `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`
  : `lsof -ti tcp:${port} -sTCP:LISTEN`;
try {
  const out = execSync(find, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  if (!out) throw new Error('not running');
  for (const pid of out.split(/\s+/).filter(Boolean)) process.kill(Number(pid));
  console.log('Claude Workspace stopped.');
} catch {
  console.log('Claude Workspace was not running.');
}
