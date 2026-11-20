import { query } from '@anthropic-ai/claude-agent-sdk';
import { cleanEnv } from './auth.ts';

/** Plan usage for the sidebar: the 5-hour and weekly limits, as /usage shows them. Null when the plan has no limits (API key). */
export type Usage = { plan: string; windows: { key: string; label: string; used: number; resetsAt: string | null }[] } | null;

const WINDOWS: [string, string][] = [['five_hour', '5-hour'], ['seven_day', 'Weekly']];

export function shapeUsage(r: any): Usage {
  if (!r?.rate_limits_available || !r.rate_limits) return null;
  const windows = WINDOWS.flatMap(([key, label]) => {
    const w = r.rate_limits[key];
    if (!w || typeof w.utilization !== 'number') return [];
    return [{ key, label, used: Math.max(0, Math.min(100, Math.round(w.utilization))), resetsAt: w.resets_at ?? null }];
  });
  if (!windows.length) return null;
  const t = String(r.subscription_type ?? '');
  return { plan: t ? t.charAt(0).toUpperCase() + t.slice(1) : '', windows };
}

/**
 * Asks Claude Code for plan usage without sending a message (no usage spent), then stops the session.
 * Uses an experimental Claude Code call: if it goes away or fails, this returns null and the panel hides.
 */
export async function readUsage(cwd: string, queryFn: typeof query = query): Promise<Usage> {
  let stop!: () => void;
  const idle = new Promise<void>((r) => (stop = r));
  async function* prompt() { await idle; }
  const q: any = queryFn({ prompt: prompt() as any, options: { cwd, env: cleanEnv(process.env), settingSources: [] } });
  try {
    const fn = q.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET;
    if (typeof fn !== 'function') return null;
    return shapeUsage(await fn.call(q, { skipBehaviors: true }));
  } catch {
    return null;
  } finally {
    stop();
    try { await q.interrupt?.(); } catch {}
    try { q.close?.(); } catch {}
    try { await q.return?.(undefined); } catch {}
  }
}
