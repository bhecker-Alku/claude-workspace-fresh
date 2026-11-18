import { query } from '@anthropic-ai/claude-agent-sdk';
import { cleanEnv, isSubscription } from './auth.ts';
import { decide, describe } from './policy.ts';
import type { Approvals } from './approvals.ts';
import type { Brain } from './brains.ts';
import type { Emit } from './events.ts';
import type { Conversation, Store } from './store.ts';

export class BusyError extends Error {
  constructor() {
    super('brain is busy');
  }
}

type ChatDeps = {
  store: Store;
  approvals: Approvals;
  emit: Emit;
  queryFn?: typeof query;
  /** Extra MCP servers for a brain's session (team-up). */
  mcpServersFor?: (brain: Brain, convId: string) => Record<string, any>;
  /** Runs before the turn; may return text to prepend to the prompt (team-up @mentions). */
  beforeTurn?: (brain: Brain, convId: string, text: string) => Promise<string>;
  /** Tool rules for the connections switched off in Connect Apps, for everyone and for this brain. */
  blocked?: (brain: Brain) => Promise<string[]>;
  /** The skills this brain may use, or undefined for all of them. */
  skillsFor?: (brain: Brain) => Promise<string[] | undefined>;
};

/**
 * Sent once, ahead of the first message of every new chat, and never shown in the chat.
 * Tells each brain how this window draws things, so no brain needs it in its own CLAUDE.md.
 */
export const DISPLAY_NOTE = `[Claude Workspace display note, from the app, not the person:
This chat window turns a \`\`\` fenced block into a card with a Copy button. The word after the opening \`\`\` is the card's title.
Put anything the person will copy and paste somewhere else in one such block, titled by what it is: an email (\`\`\`Email), a message, a reply, a snippet, a command.
Keep the explanation outside the block and only the copy-ready text inside it. Do not use fenced blocks for anything else.]

`;

export type ImageInput = { mediaType: string; data: string };

/** Plain text, or one streamed user message with the images first and the text after. */
export function buildPrompt(text: string, images: ImageInput[]): string | AsyncIterable<any> {
  if (!images.length) return text;
  const message = {
    type: 'user' as const,
    parent_tool_use_id: null,
    session_id: '',
    message: {
      role: 'user' as const,
      content: [
        ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
        { type: 'text', text: text || 'Take a look at this.' },
      ],
    },
  };
  return (async function* () { yield message; })();
}

type Block = { type: string; text?: string; name?: string; input?: Record<string, unknown> };

export function createChat(deps: ChatDeps) {
  const busy = new Set<string>();
  const queryFn = deps.queryFn ?? query;

  async function record(convId: string, event: Parameters<Emit>[0] | { type: 'user'; text: string }) {
    if (event.type !== 'user') deps.emit(event);
    if (['user', 'text', 'teamup', 'approval-resolved', 'error'].includes(event.type)) await deps.store.appendTranscript(convId, event);
  }

  async function runTurn({ brain, conv, text, images = [] }: { brain: Brain; conv: Conversation; text: string; images?: ImageInput[] }): Promise<void> {
    if (busy.has(brain.id)) throw new BusyError();
    busy.add(brain.id);
    const convId = conv.id;
    let sessionId = conv.sessionId ?? '';
    try {
      deps.emit({ type: 'step', convId, label: 'Reading your message' });
      await record(convId, { type: 'user', text, ...(images.length ? { images: images.length } : {}) } as any);
      const prefix = deps.beforeTurn ? await deps.beforeTurn(brain, convId, text) : '';
      const blocked = deps.blocked ? await deps.blocked(brain) : [];
      const skills = deps.skillsFor ? await deps.skillsFor(brain) : undefined;
      const q = queryFn({
        prompt: buildPrompt((conv.sessionId ? '' : DISPLAY_NOTE) + prefix + text, images),
        options: {
          cwd: brain.path,
          model: brain.model || undefined,
          env: cleanEnv(process.env),
          settingSources: ['user', 'project', 'local'],
          ...(blocked.length ? { disallowedTools: blocked } : {}),
          ...(skills ? { skills } : {}),
          resume: conv.sessionId ?? undefined,
          mcpServers: deps.mcpServersFor?.(brain, convId),
          permissionMode: 'default',
          hooks: { PreToolUse: [{ hooks: [policyHook({ brainPath: brain.path, calledIn: false }, (title, detail) => deps.approvals.request(convId, title, detail))] }] },
          // The hook above already decided; anything that still reaches the permission prompt was allowed there.
          canUseTool: async (_tool, input) => ({ behavior: 'allow', updatedInput: input }),
        },
      });
      const info = typeof (q as any).accountInfo === 'function' ? await (q as any).accountInfo() : null;
      if (info && !isSubscription(info)) {
        await (q as any).return?.(undefined);
        throw new Error('This session is not using your Claude subscription, so Claude Workspace stopped it. Check Claude Code settings for an API key.');
      }
      for await (const m of q as AsyncIterable<any>) {
        if (m.session_id && m.session_id !== sessionId) {
          sessionId = m.session_id;
          await deps.store.update(convId, { sessionId });
        }
        if (m.type === 'assistant') {
          for (const b of (m.message?.content ?? []) as Block[]) {
            if (b.type === 'text' && b.text) await record(convId, { type: 'text', convId, text: b.text });
            if (b.type === 'tool_use' && b.name) deps.emit({ type: 'step', convId, label: stepLabel(b.name, b.input ?? {}) });
          }
        }
        if (m.type === 'result') {
          if (m.subtype !== 'success') await record(convId, { type: 'error', convId, message: 'The brain stopped before finishing.' });
        }
      }
      await deps.store.update(convId, {});
    } catch (error) {
      await record(convId, { type: 'error', convId, message: error instanceof Error ? error.message : String(error) });
    } finally {
      busy.delete(brain.id);
      // Sent last, so the page sees the brain as free when it hears this.
      deps.emit({ type: 'done', convId, sessionId });
      if (busy.size === 0) for (const fn of idle.splice(0)) fn();
    }
  }

  // One-shot callbacks for the moment no brain is working (used to restart safely).
  const idle: (() => void)[] = [];
  const onIdle = (fn: () => void) => { if (busy.size === 0) fn(); else idle.push(fn); };

  return { runTurn, isBusy: (brainId: string) => busy.has(brainId), anyBusy: () => busy.size > 0, onIdle };
}

type Ask = (title: string, detail: string) => Promise<boolean>;

/** Enforces the Workspace policy on every tool call. Hooks run even when settings or a mode would skip the permission prompt. */
export function policyHook(ctx: { brainPath: string; calledIn: boolean }, ask?: Ask) {
  return async (input: any) => {
    const tool = String(input.tool_name ?? '');
    const args = (input.tool_input ?? {}) as Record<string, unknown>;
    const d = decide(tool, args, ctx);
    const allowed = d === 'allow' || (d === 'ask' && ask ? await ask(describe(tool, args).title, describe(tool, args).detail) : false);
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse' as const,
        permissionDecision: allowed ? ('allow' as const) : ('deny' as const),
        permissionDecisionReason: allowed ? 'Allowed by Claude Workspace' : 'Not allowed in Claude Workspace. Ask the person in plain words instead.',
      },
    };
  };
}

function stepLabel(tool: string, input: Record<string, unknown>): string {
  const file = typeof input.file_path === 'string' ? input.file_path.split(/[\\/]/).slice(-2).join('/') : '';
  if (tool === 'Read') return `Read ${file}`;
  if (tool === 'Write' || tool === 'Edit') return `Saved ${file}`;
  if (tool === 'Grep' || tool === 'Glob') return 'Searched the brain';
  if (tool === 'Skill') return `Ran ${String(input.skill ?? input.command ?? 'a recipe')}`;
  if (tool === 'mcp__workspace__ask_brain') return `Asked ${String(input.brain ?? 'another brain')}`;
  return describe(tool, input).title;
}
