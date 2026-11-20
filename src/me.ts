import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** About the person using this Workspace: their name (author on documents brains edit for them) and where finished files go. */
export type Me = { name: string; outputFolder: string };

const file = (dataDir: string) => path.join(dataDir, 'me.json');

export async function readMe(dataDir: string): Promise<Me> {
  try {
    const d = JSON.parse(await readFile(file(dataDir), 'utf8'));
    return { name: String(d.name ?? ''), outputFolder: String(d.outputFolder ?? '') };
  } catch {
    return { name: '', outputFolder: '' };
  }
}

export async function saveMe(dataDir: string, input: Partial<Me>): Promise<Me> {
  const me = {
    name: String(input.name ?? '').replace(/[\r\n[\]]/g, ' ').trim().slice(0, 80),
    outputFolder: String(input.outputFolder ?? '').replace(/[\r\n[\]]/g, '').trim().slice(0, 300),
  };
  await mkdir(dataDir, { recursive: true });
  const tmp = `${file(dataDir)}.tmp`;
  await writeFile(tmp, JSON.stringify(me, null, 2));
  await rename(tmp, file(dataDir));
  return me;
}

/** Sent with every message: whose work this is, where files go, and how to hand files back. */
export function personNote(me: Me): string {
  const who = me.name
    ? `The person is ${me.name}. Their documents are theirs: on Word edits put ${me.name} (not Claude) as the author of tracked changes and comments and in the document properties, and when suggesting Word's Review > Compare, tell them to type their own name in "Label changes with".`
    : `The person has not set their name yet (Account menu > About you); on Word edits never put Claude as the author.`;
  const where = me.outputFolder
    ? ` Save finished files they asked for in ${me.outputFolder}, with clear names that say what the file is; never overwrite (add v2, v3), and keep a short record in your memory of where each file is.`
    : '';
  return `[Workspace note about the person, from the app: ${who}${where} End your reply with a link to every file you made or changed, as [File name](file:///C:/full/path/file.docx) with forward slashes and %20 for spaces.]\n\n`;
}

/** Optional per-brain personality traits, set in Edit brain. Off unless switched on. */
export const TRAITS = ['rigid', 'creative', 'skeptic'] as const;
const TRAIT_TEXT: Record<string, string> = {
  rigid: 'Rigid: follow this brain\'s rules, templates and established ways of working exactly and consistently. Prefer clear structure, checklists and the same format every time. Do not improvise or change approach without asking; if something does not fit the rules, say so and ask.',
  creative: 'Creative: when asked to create, invent freely (ideas, names, characters, places, story, options). Never contradict saved facts, anything marked [CANON], a recap, or what the person has stated. Mark new inventions as new so the person can accept or reject them, and never save an invention as fact without their say-so. Factual questions still get factual answers.',
  skeptic: 'Skeptic: question assumptions and claims, the person\'s and your own. Point out weak evidence, gaps, risks and what could go wrong, and say plainly when you disagree, with reasons. Ask for the source when a claim has none. Stay constructive: after the challenge, still help get the work done.',
};

export function traitsNote(traits: string[] | undefined): string {
  const on = (traits ?? []).filter((t) => TRAIT_TEXT[t]);
  return on.length ? `[Personality the person switched on for you: ${on.map((t) => TRAIT_TEXT[t]).join(' ')}]\n\n` : '';
}
