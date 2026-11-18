export type WorkspaceEvent =
  | { type: 'text'; convId: string; text: string }
  | { type: 'step'; convId: string; label: string }
  | { type: 'approval'; convId: string; id: string; title: string; detail: string }
  | { type: 'approval-resolved'; convId: string; id: string; allowed: boolean }
  | { type: 'teamup'; convId: string; brain: string; question: string; answer: string; needsConfirmation: boolean }
  | { type: 'done'; convId: string; sessionId: string }
  | { type: 'error'; convId: string; message: string }
  | { type: 'restarting'; waiting: boolean; mode: 'restart' | 'shutdown'; convId?: undefined };

export type Emit = (e: WorkspaceEvent) => void;
