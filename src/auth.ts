import { query } from '@anthropic-ai/claude-agent-sdk';

const BLOCKED = /^(ANTHROPIC_API_KEY.*|ANTHROPIC_AUTH_TOKEN|ANTHROPIC_BASE_URL|CLAUDE_CODE_USE_.*|AWS_BEARER_TOKEN_BEDROCK)$/;

/** The environment every Claude session gets: never an API key, so only the subscription login is used. */
export function cleanEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined && !BLOCKED.test(k)) out[k] = v;
  return out;
}

/** True only for a first-party Claude subscription login with no API key in play. */
export function isSubscription(info: { apiKeySource?: string; apiProvider?: string; subscriptionType?: string }): boolean {
  return !info.apiKeySource && info.apiProvider === 'firstParty' && Boolean(info.subscriptionType);
}

export type SignIn = { ok: true; account: string } | { ok: false; reason: string };
let cached: Promise<SignIn> | null = null;

export function checkSignIn(): Promise<SignIn> {
  cached ??= (async (): Promise<SignIn> => {
    try {
      const q = query({ prompt: 'ok', options: { env: cleanEnv(process.env), maxTurns: 1 } });
      const info = await q.accountInfo();
      await q.return(undefined);
      if (!isSubscription(info)) {
        return { ok: false, reason: 'Claude Code is not signed in with a Claude subscription.' };
      }
      return { ok: true, account: `${info.email ?? 'signed in'} · ${info.subscriptionType}` };
    } catch (error) {
      return { ok: false, reason: String(error instanceof Error ? error.message : error) };
    }
  })();
  const p = cached;
  p.then((r) => { if (!r.ok) cached = null; });
  return p;
}
