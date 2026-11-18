import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readAliases, writeAliases } from './aliases.ts';

// Sidebar sections, in the order the person arranged them. Kept in the app, not in brains.
const file = (dataDir: string) => path.join(dataDir, 'groups.json');
const clean = (name: string) => String(name ?? '').trim().slice(0, 40);

async function readList(dataDir: string): Promise<string[]> {
  try {
    return JSON.parse(await readFile(file(dataDir), 'utf8'));
  } catch {
    return [];
  }
}
async function writeList(dataDir: string, list: string[]): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(file(dataDir), JSON.stringify([...new Set(list)], null, 2));
}

/** Saved groups first, then any group a brain uses that is not saved yet. */
export async function listGroups(dataDir: string): Promise<string[]> {
  const list = await readList(dataDir);
  for (const a of Object.values(await readAliases(dataDir))) if (a.group && !list.includes(a.group)) list.push(a.group);
  return list;
}

export async function addGroup(dataDir: string, name: string): Promise<void> {
  const n = clean(name);
  if (!n) throw new Error('empty');
  const list = await listGroups(dataDir);
  if (!list.includes(n)) await writeList(dataDir, [...list, n]);
}

export async function renameGroup(dataDir: string, from: string, to: string): Promise<void> {
  const t = clean(to);
  if (!t) throw new Error('empty');
  const list = (await listGroups(dataDir)).map((g) => (g === from ? t : g));
  await writeList(dataDir, list);
  const all = await readAliases(dataDir);
  for (const a of Object.values(all)) if (a.group === from) a.group = t;
  await writeAliases(dataDir, all);
}

/** Removes a group; its brains go back to the default Brains or Projects section. */
export async function deleteGroup(dataDir: string, name: string): Promise<void> {
  await writeList(dataDir, (await listGroups(dataDir)).filter((g) => g !== name));
  const all = await readAliases(dataDir);
  for (const a of Object.values(all)) if (a.group === name) a.group = '';
  await writeAliases(dataDir, all);
}

/** Drag and drop: puts one brain in a group, keeping its name, role and look. */
export async function moveToGroup(dataDir: string, id: string, group: string): Promise<void> {
  const g = clean(group);
  const all = await readAliases(dataDir);
  all[id] = { ...(all[id] ?? { alias: '', role: '', group: '' }), group: g };
  await writeAliases(dataDir, all);
  if (g) await addGroup(dataDir, g);
}

// The order of brains in the sidebar, as the person dragged them. Brain ids, top to bottom.
const orderFile = (dataDir: string) => path.join(dataDir, 'order.json');

export async function readOrder(dataDir: string): Promise<string[]> {
  try {
    const list = JSON.parse(await readFile(orderFile(dataDir), 'utf8'));
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveOrder(dataDir: string, ids: unknown[]): Promise<void> {
  const clean = [...new Set(ids.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200))].slice(0, 1000);
  await mkdir(dataDir, { recursive: true });
  await writeFile(orderFile(dataDir), JSON.stringify(clean, null, 2));
}

/** Brains in the saved order; any brain not in it yet keeps its usual place after the ordered ones. */
export function sortByOrder<T extends { id: string }>(list: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return list.map((b, i) => ({ b, i })).sort((x, y) => {
    const rx = rank.get(x.b.id) ?? order.length + x.i, ry = rank.get(y.b.id) ?? order.length + y.i;
    return rx - ry;
  }).map((x) => x.b);
}
