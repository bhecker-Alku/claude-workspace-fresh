import { query } from '@anthropic-ai/claude-agent-sdk';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cleanEnv } from './auth.ts';

/** One outside app the brains can reach (an MCP server), as the Connect Apps window shows it. */
export type Connection = {
  name: string;
  label: string;
  status: 'connected' | 'needs-auth' | 'failed' | 'pending' | 'disabled' | string;
  scope: string;
  tools: number;
  error?: string;
  enabled: boolean;
};

const file = (dataDir: string) => path.join(dataDir, 'connections.json');

/** Connections the person switched off in the app. Brains get no tools from these. */
export async function readDisabled(dataDir: string): Promise<string[]> {
  try {
    const d = JSON.parse(await readFile(file(dataDir), 'utf8'));
    return Array.isArray(d.disabled) ? d.disabled.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function setEnabled(dataDir: string, name: string, enabled: boolean): Promise<void> {
  const off = new Set(await readDisabled(dataDir));
  if (enabled) off.delete(name);
  else off.add(name);
  await mkdir(dataDir, { recursive: true });
  const tmp = `${file(dataDir)}.tmp`;
  await writeFile(tmp, JSON.stringify({ disabled: [...off].sort() }, null, 2));
  await rename(tmp, file(dataDir));
}

/** The tool prefix Claude Code gives a server's tools: "claude.ai Microsoft 365" -> "mcp__claude_ai_Microsoft_365". */
export const toolPrefix = (name: string) => 'mcp__' + name.replace(/[^A-Za-z0-9_-]/g, '_');

/** Rules that block every tool of the switched-off connections, for a brain's session. */
export async function blockedTools(dataDir: string): Promise<string[]> {
  return (await readDisabled(dataDir)).map(toolPrefix);
}

/** The name people read: "claude.ai Microsoft 365" -> "Microsoft 365", "plugin:vercel:vercel" -> "Vercel". */
export function labelOf(name: string): string {
  const s = name.replace(/^claude\.ai\s+/i, '').replace(/^plugin:[^:]+:/i, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A skill (or custom command) a brain can use, as Connect Apps and the Edit menu show it. */
export type Skill = { name: string; label: string; group: string; description: string };

/** Plugins whose skills show first, under "Featured". Add plugin names here to pin them. */
export const FEATURED_PLUGINS = new Set<string>([]);

/** "my-plugin:report" -> label "report", group "my-plugin"; "pdf" -> group "Your skills". */
export function skillOf(name: string, description: string): Skill {
  const at = name.indexOf(':');
  const plugin = at > 0 ? name.slice(0, at) : '';
  const group = !plugin ? 'Your skills' : FEATURED_PLUGINS.has(plugin) ? 'Featured' : plugin;
  return { name, label: at > 0 ? name.slice(at + 1) : name, group, description: description.replace(/^\([^)]*\)\s*/, '') };
}

export type Setup = { connections: Omit<Connection, 'enabled'>[]; skills: Skill[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Asks Claude Code which connections a brain would get and how each one is doing.
 * Starts a session without sending a message (no usage), reads the status, then stops it.
 */
export async function readStatus(cwd: string, queryFn: typeof query = query, waitMs = 15_000): Promise<Setup> {
  let stop!: () => void;
  const idle = new Promise<void>((r) => (stop = r));
  async function* prompt() { await idle; }
  const q: any = queryFn({ prompt: prompt() as any, options: { cwd, env: cleanEnv(process.env), settingSources: ['user', 'project', 'local'] } });
  try {
    const until = Date.now() + waitMs;
    let list: any[] = await q.mcpServerStatus();
    // Remote connectors report "pending" while they dial in; give them a moment.
    while (list.some((s) => s.status === 'pending') && Date.now() < until) {
      await sleep(1000);
      list = await q.mcpServerStatus();
    }
    const commands: any[] = (await q.supportedCommands?.()) ?? [];
    const skills = commands.filter((c) => !c.builtin).map((c) => skillOf(String(c.name), String(c.description ?? '')));
    const connections = list.map((s) => ({
      name: String(s.name),
      label: labelOf(String(s.name)),
      status: String(s.status),
      scope: String(s.source ?? s.scope ?? ''),
      tools: Array.isArray(s.tools) ? s.tools.length : 0,
      ...(s.error ? { error: String(s.error) } : {}),
    }));
    return { connections, skills };
  } finally {
    stop();
    try { await q.interrupt?.(); } catch {}
    try { q.close?.(); } catch {}
    try { await q.return?.(undefined); } catch {}
  }
}
