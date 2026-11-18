import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.WORKSPACE_PORT ?? 4317),
  // Brains are looked for next to the app folder unless WORKSPACE_BRAINS_ROOT says otherwise.
  brainsRoot: process.env.WORKSPACE_BRAINS_ROOT ?? path.dirname(repoRoot),
  dataDir: path.join(repoRoot, '.workspace'),
  publicDir: path.join(repoRoot, 'public'),
};
