import { randomUUID } from 'node:crypto';
import type { Emit } from './events.ts';

type Pending = { convId: string; finish: (allowed: boolean) => void };

/** Approval cards waiting on the person. Unanswered cards deny after the timeout (10 minutes by default). */
export function createApprovals(emit: Emit) {
  const pending = new Map<string, Pending>();

  return {
    request(convId: string, title: string, detail: string, timeoutMs = 600_000): Promise<boolean> {
      const id = randomUUID();
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => finish(false), timeoutMs);
        function finish(allowed: boolean) {
          if (!pending.delete(id)) return;
          clearTimeout(timer);
          emit({ type: 'approval-resolved', convId, id, allowed });
          resolve(allowed);
        }
        pending.set(id, { convId, finish });
        emit({ type: 'approval', convId, id, title, detail });
      });
    },
    /** Deny every card still waiting in one chat (used by Stop). */
    cancelConv(convId: string): void {
      for (const p of [...pending.values()]) if (p.convId === convId) p.finish(false);
    },
    resolve(id: string, allowed: boolean): boolean {
      const p = pending.get(id);
      if (!p) return false;
      p.finish(allowed);
      return true;
    },
  };
}

export type Approvals = ReturnType<typeof createApprovals>;
