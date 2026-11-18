import { readdir, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Claude Code keeps each folder's chats in ~/.claude/projects/<folder with every non-alphanumeric character as a dash>. */
export function claudeProjectDir(folder: string, home = os.homedir()): string {
  return path.join(home, '.claude', 'projects', path.resolve(folder).replace(/[^A-Za-z0-9]/g, '-'));
}

type Line = { type?: string; isMeta?: boolean; isSidechain?: boolean; message?: { content?: unknown } };

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
}

function isNoise(text: string): boolean {
  return !text.trim() || /^<(local-command|command-name|system-reminder|task-notification)/.test(text.trim());
}

function toItems(raw: string): { type: 'user' | 'text'; text: string }[] {
  const items: { type: 'user' | 'text'; text: string }[] = [];
  for (const l of raw.split('\n')) {
    let line: Line;
    try { line = JSON.parse(l); } catch { continue; }
    if (line.isMeta || line.isSidechain || (line.type !== 'user' && line.type !== 'assistant')) continue;
    const text = textOf(line.message?.content);
    if (isNoise(text)) continue;
    items.push({ type: line.type === 'user' ? 'user' : 'text', text });
  }
  return items;
}

export type ClaudeSession = { id: string; title: string; modified: string };

/** Recent Claude Code chats for a folder, newest first. */
export async function listClaudeSessions(folder: string, home = os.homedir(), limit = 20): Promise<ClaudeSession[]> {
  const dir = claudeProjectDir(folder, home);
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.jsonl'));
  const out: (ClaudeSession & { t: number })[] = [];
  for (const f of files) {
    const s = await stat(path.join(dir, f));
    const head = (await readFile(path.join(dir, f), 'utf8')).slice(0, 200_000);
    const first = toItems(head).find((i) => i.type === 'user');
    out.push({ id: f.slice(0, -6), title: (first?.text ?? 'Claude Code chat').slice(0, 80), modified: s.mtime.toISOString(), t: s.mtimeMs });
  }
  return out.sort((a, b) => b.t - a.t).slice(0, limit).map(({ t, ...s }) => s);
}

/** The visible messages of a Claude Code chat (last 300), for showing its history. */
export async function readClaudeSession(folder: string, id: string, home = os.homedir()): Promise<{ type: 'user' | 'text'; text: string }[]> {
  if (!/^[A-Za-z0-9-]+$/.test(id)) throw new Error('bad-session');
  const raw = await readFile(path.join(claudeProjectDir(folder, home), `${id}.jsonl`), 'utf8');
  return toItems(raw).slice(-300);
}
