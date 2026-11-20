import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const COLORS = ['purple', 'teal', 'amber', 'pink', 'blue', 'lime'] as const;
export const EYES = ['pill', 'oval', 'wide', 'square'] as const;
export const MOUTHS = ['smile', 'grin', 'smirk', 'flat'] as const;
export const STYLES = ['jelly', 'glass', 'shadow'] as const;
export type Avatar = { color: string; eyes: string; mouth: string; style: string; theme?: string; character?: string; packEyes?: string; packMouth?: string };
/** Themed avatar packs (public/jelly-packs.js draws them). Character and pack eye/mouth names are checked there. */
export const THEMES = ['christmas', 'halloween', 'pokipals'] as const;
/** Models a brain can run on; '' means Claude Code's own default. */
export const MODELS = ['', 'opus', 'sonnet', 'haiku'] as const;
export type Alias = { alias: string; role: string; group: string; avatar?: Avatar; model?: string; skillsOff?: string[]; appsOff?: string[] };
export const MAX_ALIAS = 40;

const file = (dataDir: string) => path.join(dataDir, 'aliases.json');

/** A stable look for a brain nobody has styled yet, so each one still looks different. */
export function defaultAvatar(id: string): Avatar {
  const n = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return { color: COLORS[n % COLORS.length], eyes: EYES[(n >>> 3) % EYES.length], mouth: MOUTHS[(n >>> 6) % 3], style: 'jelly' };
}

function cleanAvatar(input: unknown, previous: Avatar): Avatar {
  const a = (input ?? {}) as Record<string, unknown>;
  const pick = (v: unknown, allowed: readonly string[], fallback: string) => (typeof v === 'string' && allowed.includes(v) ? v : fallback);
  return {
    color: pick(a.color, COLORS, previous.color),
    eyes: pick(a.eyes, EYES, previous.eyes),
    mouth: pick(a.mouth, MOUTHS, previous.mouth),
    style: pick(a.style, STYLES, previous.style),
    // A themed pack look; the classic choices above stay underneath so going back to Classic restores them.
    ...(typeof a.theme === 'string' && (THEMES as readonly string[]).includes(a.theme)
      ? { theme: a.theme, ...Object.fromEntries((['character', 'packEyes', 'packMouth'] as const).filter((k) => typeof a[k] === 'string' && /^[a-z]{1,24}$/i.test(a[k] as string)).map((k) => [k, a[k] as string])) }
      : {}),
  };
}

/** Names and looks people give their brains, kept in the app (never in the brain files). */
export async function readAliases(dataDir: string): Promise<Record<string, Alias>> {
  try {
    return JSON.parse(await readFile(file(dataDir), 'utf8'));
  } catch {
    return {};
  }
}

export async function setAlias(dataDir: string, id: string, input: Partial<Alias>): Promise<void> {
  const all = await readAliases(dataDir);
  const previous = all[id]?.avatar ?? defaultAvatar(id);
  const next: Alias = { alias: String(input.alias ?? '').trim(), role: String(input.role ?? '').trim(), group: String(input.group ?? '').trim() };
  if (input.avatar !== undefined || all[id]?.avatar) next.avatar = cleanAvatar(input.avatar, previous);
  const model = input.model === undefined ? all[id]?.model : String(input.model);
  if (model && (MODELS as readonly string[]).includes(model)) next.model = model;
  for (const k of ['skillsOff', 'appsOff'] as const) {
    const v = input[k] === undefined ? all[id]?.[k] : input[k];
    const list = Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200))].slice(0, 500) : [];
    if (list.length) next[k] = list.sort();
  }
  if (!next.alias && !next.role && !next.group && !next.avatar && !next.model && !next.skillsOff && !next.appsOff) delete all[id];
  else all[id] = next;
  await mkdir(dataDir, { recursive: true });
  const tmp = `${file(dataDir)}.tmp`;
  await writeFile(tmp, JSON.stringify(all, null, 2));
  await rename(tmp, file(dataDir));
}

export async function writeAliases(dataDir: string, all: Record<string, Alias>): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const tmp = `${file(dataDir)}.tmp`;
  await writeFile(tmp, JSON.stringify(all, null, 2));
  await rename(tmp, file(dataDir));
}
