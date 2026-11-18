import { appendFile, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export type Conversation = { id: string; brainId: string; title: string; sessionId: string | null; updatedAt: string };

/** Conversations index in one JSON file; each transcript is a JSONL file of UI events. */
export function createStore(dataDir: string) {
  const indexFile = path.join(dataDir, 'conversations.json');
  const transcriptDir = path.join(dataDir, 'transcripts');
  let writing: Promise<unknown> = Promise.resolve();
  let appending: Promise<unknown> = Promise.resolve();

  async function load(): Promise<Conversation[]> {
    try {
      return JSON.parse(await readFile(indexFile, 'utf8'));
    } catch {
      return [];
    }
  }
  async function save(all: Conversation[]): Promise<void> {
    await mkdir(dataDir, { recursive: true });
    const tmp = `${indexFile}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(all, null, 2));
    await rename(tmp, indexFile);
  }
  /** Every read-modify-write runs in one queue so concurrent changes never overwrite each other. */
  function change<T>(fn: (all: Conversation[]) => Promise<T>): Promise<T> {
    const run = writing.then(async () => fn(await load()));
    writing = run.then(() => undefined, () => undefined);
    return run;
  }

  return {
    async list(brainId?: string) {
      const all = await load();
      return all.filter((c) => !brainId || c.brainId === brainId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    /** Deletes one chat and its saved history. The Claude Code chat file, if any, is left alone. */
    async remove(id: string) {
      await change(async (all) => save(all.filter((c) => c.id !== id)));
      await unlink(path.join(transcriptDir, `${path.basename(id)}.jsonl`)).catch(() => undefined);
    },
    async removeAll(brainId: string) {
      const gone = (await load()).filter((c) => c.brainId === brainId).map((c) => c.id);
      await change(async (all) => save(all.filter((c) => c.brainId !== brainId)));
      for (const id of gone) await unlink(path.join(transcriptDir, `${path.basename(id)}.jsonl`)).catch(() => undefined);
    },
    async get(id: string) {
      return (await load()).find((c) => c.id === id) ?? null;
    },
    async create(brainId: string, title: string) {
      const c: Conversation = { id: randomUUID(), brainId, title: title.slice(0, 80) || 'New chat', sessionId: null, updatedAt: new Date().toISOString() };
      await change((all) => save([...all, c]));
      return c;
    },
    async update(id: string, patch: Partial<Conversation>) {
      await change(async (all) => {
        const i = all.findIndex((c) => c.id === id);
        if (i < 0) return;
        all[i] = { ...all[i], ...patch, id, updatedAt: new Date().toISOString() };
        await save(all);
      });
    },
    appendTranscript(id: string, event: object): Promise<void> {
      // Appends run in order so events land in the transcript as they happened.
      const run = appending.then(async () => {
        await mkdir(transcriptDir, { recursive: true });
        await appendFile(path.join(transcriptDir, `${path.basename(id)}.jsonl`), `${JSON.stringify(event)}\n`);
      });
      appending = run.catch(() => undefined);
      return run;
    },
    async readTranscript(id: string): Promise<object[]> {
      const text = await readFile(path.join(transcriptDir, `${path.basename(id)}.jsonl`), 'utf8').catch(() => '');
      return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    },
  };
}

export type Store = ReturnType<typeof createStore>;
