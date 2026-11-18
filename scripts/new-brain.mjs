// Makes a new brain from the brain template: unzips it into a folder named for the agent, next to the other brains.
//
//   node scripts/new-brain.mjs "Grant Writer"            -> <brains folder>/grant-writer
//   node scripts/new-brain.mjs "Grant Writer" --into D:/brains --template D:/brain-template.zip
//
// The brains folder is the one that holds this app's folder (the same place the app looks for brains),
// unless WORKSPACE_BRAINS_ROOT or --into says otherwise. Claude Workspace lists the new brain right away.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATE = path.join(APP, 'templates', 'brain-template.zip');
export const BRAINS_ROOT = process.env.WORKSPACE_BRAINS_ROOT ?? path.dirname(APP);

/** "Grant Writer!" -> "grant-writer". Empty when nothing usable is left. */
export const folderName = (name) => String(name ?? '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Unzips with the system's own tool: Windows and Mac tar read zip files; elsewhere unzip or PowerShell. */
function unzip(zip, dest) {
  const tries = process.platform === 'win32'
    ? [[path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', zip, '-C', dest]],
       ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`]]]
    : [['tar', ['-xf', zip, '-C', dest]], ['unzip', ['-q', '-o', zip, '-d', dest]]];
  let last;
  for (const [cmd, args] of tries) {
    try { execFileSync(cmd, args, { stdio: 'pipe', windowsHide: true }); return; } catch (e) { last = e; }
  }
  throw new Error(`could not unzip the template (${last?.message ?? 'no unzip tool'})`);
}

/** Creates the brain and returns its folder. Refuses to touch a folder that already exists. */
export function newBrain(name, { into = BRAINS_ROOT, template = TEMPLATE } = {}) {
  const slug = folderName(name);
  if (!slug) throw new Error('Give the brain a name, like "Grant Writer".');
  if (!existsSync(template)) throw new Error(`The brain template is missing: ${template}`);
  const dest = path.join(path.resolve(into), slug);
  if (existsSync(dest)) throw new Error(`A folder called "${slug}" already exists. Pick another name.`);
  mkdirSync(dest, { recursive: true });
  try {
    unzip(template, dest);
    // A zip made with a top folder: lift its contents up one level.
    const entries = readdirSync(dest);
    if (!existsSync(path.join(dest, 'brain.yaml')) && entries.length === 1 && existsSync(path.join(dest, entries[0], 'brain.yaml'))) {
      const inner = path.join(dest, entries[0]);
      for (const e of readdirSync(inner)) renameSync(path.join(inner, e), path.join(dest, e));
      rmSync(inner, { recursive: true, force: true });
    }
    const yaml = path.join(dest, 'brain.yaml');
    if (!existsSync(yaml)) throw new Error('The template has no brain.yaml, so it is not a brain template.');
    writeFileSync(yaml, readFileSync(yaml, 'utf8').replace(/^brain:.*$/m, `brain: ${slug}`));
    // Start clean even if the template was zipped from a used brain.
    for (const f of ['brain/ledger.jsonl', 'brain/.state.json']) rmSync(path.join(dest, f), { force: true });
    for (const f of readdirSync(path.join(dest, 'brain')).filter((x) => x.startsWith('.turn-'))) rmSync(path.join(dest, 'brain', f), { force: true });
    try { execFileSync(process.execPath, [path.join(dest, 'engine', 'tools', 'brain.mjs'), 'refresh'], { cwd: dest, stdio: 'pipe' }); } catch {}
  } catch (e) {
    rmSync(dest, { recursive: true, force: true });
    throw e;
  }
  return dest;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const opt = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
  const into = opt('--into'), template = opt('--template');
  try {
    const dir = newBrain(args.join(' '), { ...(into ? { into } : {}), ...(template ? { template } : {}) });
    console.log(`Created ${dir}\nIt shows up in Claude Workspace now. Open it and say "set me up".`);
  } catch (e) { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); }
}
