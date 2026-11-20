import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { cleanEnv } from './auth.ts';
import { decide } from './policy.ts';
import { policyHook } from './chat.ts';
import type { Brain } from './brains.ts';
import type { Emit } from './events.ts';

/** Finds @brain mentions by folder id or brain name; ignores emails and unknown names. */
export function parseMentions(text: string, brains: Brain[]): { brainIds: string[]; rest: string } {
  const brainIds: string[] = [];
  const rest = text.replace(/(^|\s)@([\w-]+)/g, (whole, lead: string, word: string) => {
    const w = word.toLowerCase();
    const hit = brains.find((b) => b.id.toLowerCase() === w || b.name.toLowerCase() === w || (b.alias ?? '').replace(/\s+/g, '').toLowerCase() === w);
    if (!hit) return whole;
    if (!brainIds.includes(hit.id)) brainIds.push(hit.id);
    return lead;
  });
  return { brainIds, rest: rest.replace(/\s+/g, ' ').trim() };
}

/** A short, answer-only session in another brain's folder. It cannot write notes, push, or call further brains. */
export async function askBrain(args: { from: Brain; to: Brain; question: string; queryFn?: typeof query }): Promise<{ answer: string; needsConfirmation: boolean }> {
  const q = (args.queryFn ?? query)({
    prompt: args.question,
    options: {
      cwd: args.to.path,
      model: args.to.model || undefined,
      env: cleanEnv(process.env),
      settingSources: ['project'],
      maxTurns: 12,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `You are answering a question from the ${args.from.name} brain. Answer only. Do not harvest, open pull requests or push. If you reach a checkpoint that needs a person, stop and say NEEDS CONFIRMATION: <what>.`,
      },
      permissionMode: 'default',
      hooks: { PreToolUse: [{ hooks: [policyHook({ brainPath: args.to.path, calledIn: true })] }] },
      canUseTool: async (name, input) =>
        decide(name, input, { brainPath: args.to.path, calledIn: true }) === 'allow'
          ? { behavior: 'allow', updatedInput: input }
          : { behavior: 'deny', message: 'Answer only: this action is not allowed for a called-in brain.' },
    },
  });
  let answer = '';
  for await (const m of q as AsyncIterable<any>) {
    if (m.type === 'result') answer = typeof m.result === 'string' ? m.result : 'The brain could not finish an answer.';
  }
  return { answer, needsConfirmation: /NEEDS CONFIRMATION/.test(answer) };
}

/** The ask_brain tool given to the brain you are talking to. */
export function teamupServer(from: Brain, brains: Brain[], emit: Emit, convId: string) {
  const others = brains.filter((b) => b.id !== from.id && b.kind !== 'project');
  const list = others.map((b) => `- ${b.id}${b.alias ? ` (called ${b.alias}${b.role ? `, ${b.role}` : ''})` : ''}: ${b.blurb || 'no description'}`).join('\n');
  return createSdkMcpServer({
    name: 'workspace',
    tools: [
      tool(
        'ask_brain',
        `Ask another brain a question, or pass it notes and questions to answer (for example "send this to Victor"), when it holds knowledge or a role this brain does not. Its answer comes back here. Available brains:\n${list}`,
        { brain: z.string().describe('brain id, or the name it is called'), question: z.string() },
        async ({ brain, question }) => {
          const key = brain.toLowerCase();
          const to = others.find((b) => b.id.toLowerCase() === key || b.name.toLowerCase() === key || (b.alias ?? '').toLowerCase() === key);
          if (!to) return { content: [{ type: 'text', text: `Unknown brain ${brain}. Choose one of: ${others.map((b) => b.id).join(', ')}` }] };
          const r = await askBrain({ from, to, question });
          emit({ type: 'teamup', convId, brain: to.alias || to.id, question, ...r });
          return { content: [{ type: 'text', text: r.answer }] };
        },
      ),
    ],
  });
}

/** @mentions: ask each named brain first and hand the answers to the current brain. */
export async function mentionPrefix(from: Brain, brains: Brain[], text: string, emit: Emit, convId: string, queryFn?: typeof query): Promise<string> {
  const { brainIds, rest } = parseMentions(text, brains.filter((b) => b.kind !== 'project'));
  let prefix = '';
  for (const id of brainIds.filter((id) => id !== from.id)) {
    const to = brains.find((b) => b.id === id)!;
    const r = await askBrain({ from, to, question: rest, queryFn });
    emit({ type: 'teamup', convId, brain: to.alias || to.id, question: rest, ...r });
    prefix += `Answer from the ${to.name} brain:\n${r.answer}\n\n`;
  }
  return prefix;
}
