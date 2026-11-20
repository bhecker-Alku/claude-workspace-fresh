import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { query } from '@anthropic-ai/claude-agent-sdk';
import { config } from './config.ts';
import { checkSignIn } from './auth.ts';
import { addFolder, allBrains, brainStatus, readCheckpoints, readGraph, searchNotes, removeBrainFolder, type Brain } from './brains.ts';
import { listFolders } from './folders.ts';
import { MAX_ALIAS, setAlias } from './aliases.ts';
import { importBrand, readBrand, removeBrand, saveBrand } from './brand.ts';
import { newBrain } from '../scripts/new-brain.mjs';
import { blockedTools, readDisabled, readStatus, setEnabled, toolPrefix, type Connection, type Setup } from './connections.ts';
import { addGroup, deleteGroup, listGroups, moveToGroup, readOrder, renameGroup, saveOrder, sortByOrder } from './groups.ts';
import { listClaudeSessions, readClaudeSession } from './sessions.ts';
import type { ImageInput } from './chat.ts';
import { createStore } from './store.ts';
import { createApprovals } from './approvals.ts';
import { BusyError, createChat } from './chat.ts';
import { mentionPrefix, teamupServer } from './teamup.ts';
import { dropMessage, saveDrop } from './files.ts';
import { listLibrary, openFile, openWorkspaceFile } from './library.ts';
import { outlookAvailable, outlookServer } from './outlook.ts';
import type { WorkspaceEvent } from './events.ts';

type AppOptions = { brainsRoot: string; dataDir: string; queryFn?: typeof query; restartFn?: () => void; shutdownFn?: () => void; codeDir?: string };

/** Newest change time of any file under a folder (the server's own code). 0 when unreadable. */
async function newestChange(dir: string): Promise<number> {
  let newest = 0;
  try {
    for (const e of await readdir(dir, { withFileTypes: true, recursive: true })) {
      if (!e.isFile()) continue;
      const s = await stat(path.join(e.parentPath, e.name)).catch(() => null);
      if (s && s.mtimeMs > newest) newest = s.mtimeMs;
    }
  } catch {}
  return newest;
}

/** Stops this server. Start it again with the Start file or `npm start`. */
function defaultShutdown() {
  setTimeout(() => process.exit(0), 200);
}

/** Starts a fresh server once this one has let go of the port, then exits this one. */
function defaultRestart() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  spawn(process.execPath, [path.join(root, 'scripts', 'restart.mjs')], { cwd: root, detached: true, stdio: 'ignore', windowsHide: true }).unref();
  setTimeout(() => process.exit(0), 200);
}

export function createApp(opts: AppOptions) {
  const app = new Hono();
  const store = createStore(opts.dataDir);
  const listeners = new Set<(e: WorkspaceEvent) => void>();
  const emit = (e: WorkspaceEvent) => {
    if (e.type === 'teamup' || e.type === 'approval' || e.type === 'approval-resolved') void store.appendTranscript(e.convId, e);
    for (const l of listeners) l(e);
  };
  const approvals = createApprovals(emit);
  let brainsCache: Brain[] = [];
  const brains = async () => (brainsCache = await allBrains(opts.brainsRoot, opts.dataDir));
  const brainById = async (id: string) => (await brains()).find((b) => b.id === id);
  const chat = createChat({
    store, approvals, emit, queryFn: opts.queryFn,
    mcpServersFor: (brain, convId) => ({ workspace: teamupServer(brain, brainsCache, emit, convId), ...(outlookAvailable() ? { outlook: outlookServer() } : {}) }),
    blocked: async (brain) => [...(await blockedTools(opts.dataDir)), ...(brain.appsOff ?? []).map(toolPrefix)],
    skillsFor: async (brain) => {
      if (!brain.skillsOff?.length) return undefined;
      const off = new Set(brain.skillsOff);
      return (await setup()).skills.map((s) => s.name).filter((n) => !off.has(n));
    },
    beforeTurn: (brain, convId, text) => mentionPrefix(brain, brainsCache, text, emit, convId, opts.queryFn),
  });

  let restartDecided = false;
  async function startTurn(brain: Brain, convId: string, text: string, images: ImageInput[] = []) {
    const conv = await store.get(convId);
    if (!conv) return 'missing' as const;
    if (restartDecided) return 'restarting' as const;
    if (chat.isBusy(brain.id)) return 'busy' as const;
    if (conv.title === 'New chat') await store.update(conv.id, { title: text.slice(0, 60) });
    chat.runTurn({ brain, conv, text, images }).catch((error) => {
      if (!(error instanceof BusyError)) emit({ type: 'error', convId, message: String(error) });
    });
    return 'started' as const;
  }

  // Only this machine's own page may use the API: blocks DNS rebinding and cross-site requests.
  const LOCAL_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/i;
  app.use('*', async (c, next) => {
    const host = c.req.header('host') ?? new URL(c.req.url).host;
    if (!LOCAL_HOST.test(host)) return c.json({ error: 'forbidden' }, 403);
    const origin = c.req.header('origin');
    if (origin && origin !== 'null') {
      let ok = false;
      try { ok = LOCAL_HOST.test(new URL(origin).host) && new URL(origin).host === host; } catch {}
      if (!ok) return c.json({ error: 'forbidden' }, 403);
    } else if (origin === 'null') return c.json({ error: 'forbidden' }, 403);
    if (c.req.method === 'POST') {
      const type = c.req.header('content-type') ?? '';
      const multipart = c.req.path.endsWith('/files') && type.startsWith('multipart/form-data');
      if (!multipart && !type.startsWith('application/json')) return c.json({ error: 'json only' }, 415);
      if (c.req.header('sec-fetch-site') && !['same-origin', 'none'].includes(c.req.header('sec-fetch-site')!)) return c.json({ error: 'forbidden' }, 403);
    }
    await next();
  });

  app.get('/api/session', async (c) => c.json(await checkSignIn()));
  // "Update ready": the server's own code changed after it started, so a restart would pick it up.
  const startedAt = Date.now();
  const codeDir = opts.codeDir ?? path.dirname(fileURLToPath(import.meta.url));
  app.get('/api/health', async (c) => c.json({ startedAt: new Date(startedAt).toISOString(), updateReady: (await newestChange(codeDir)) > startedAt }));
  app.get('/api/brains', async (c) => {
    const list = sortByOrder(await brains(), await readOrder(opts.dataDir));
    const convs = await store.list();
    return c.json(list.map((b) => ({ ...b, busy: chat.isBusy(b.id), lastTitle: convs.find((x) => x.brainId === b.id)?.title ?? '' })));
  });
  app.get('/api/folders', async (c) => c.json(await listFolders(c.req.query('path') || opts.brainsRoot)));
  app.post('/api/folders/add', async (c) => {
    const { path: dir } = await c.req.json().catch(() => ({ path: '' }));
    try {
      return c.json(await addFolder(opts.dataDir, String(dir)), 201);
    } catch {
      return c.json({ error: 'That folder could not be added.' }, 400);
    }
  });
  app.get('/api/brains/:id/claude-sessions', async (c) => {
    const b = await brainById(c.req.param('id'));
    return b ? c.json(await listClaudeSessions(b.path)) : c.json({ error: 'not found' }, 404);
  });
  app.post('/api/brains/:id/claude-sessions/:sid/continue', async (c) => {
    const b = await brainById(c.req.param('id'));
    if (!b) return c.json({ error: 'not found' }, 404);
    try {
      const items = await readClaudeSession(b.path, c.req.param('sid'));
      const title = items.find((i) => i.type === 'user')?.text ?? 'Claude Code chat';
      const conv = await store.create(b.id, title.slice(0, 60));
      await store.update(conv.id, { sessionId: c.req.param('sid') });
      for (const i of items) await store.appendTranscript(conv.id, i);
      await store.appendTranscript(conv.id, { type: 'note', text: 'Continued from Claude Code. Do not use that chat in the terminal at the same time.' });
      return c.json({ ...conv, sessionId: c.req.param('sid') }, 201);
    } catch {
      return c.json({ error: 'That Claude Code chat could not be opened.' }, 400);
    }
  });
  // Connect Apps: every outside app and skill the brains can reach, with status. Checked at most once a minute unless asked.
  let connCache: { at: number; setup: Setup } | null = null;
  const setup = async (refresh = false) => {
    if (!connCache || refresh || Date.now() - connCache.at > 60_000) connCache = { at: Date.now(), setup: await readStatus(process.cwd(), opts.queryFn) };
    return connCache.setup;
  };
  app.get('/api/connections', async (c) => {
    try {
      const s = await setup(Boolean(c.req.query('refresh')));
      const off = new Set(await readDisabled(opts.dataDir));
      const items: Connection[] = s.connections.map((x) => ({ ...x, enabled: !off.has(x.name) }));
      // Outlook on this PC (read-only), built into the app rather than a Claude connector.
      if (outlookAvailable()) items.unshift({ name: 'outlook', label: 'Outlook (this PC, read-only)', status: 'connected', scope: 'local', tools: 5, enabled: !off.has('outlook') });
      return c.json({ items, skills: s.skills, checkedAt: connCache!.at });
    } catch (e) {
      return c.json({ error: 'Could not check connections: ' + (e instanceof Error ? e.message : String(e)) }, 500);
    }
  });
  app.post('/api/connections/toggle', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const name = String(body.name ?? '');
    if (!name || name.length > 200) return c.json({ error: 'name is required' }, 400);
    await setEnabled(opts.dataDir, name, body.enabled !== false);
    return c.json({ ok: true });
  });
  // New brain from the template: unzipped into a folder named for the agent, next to the other brains.
  app.post('/api/brains/new', async (c) => {
    const { name } = await c.req.json().catch(() => ({ name: '' }));
    try {
      const dir = newBrain(String(name ?? ''), { into: opts.brainsRoot });
      const b = (await brains()).find((x) => path.resolve(x.path).toLowerCase() === path.resolve(dir).toLowerCase());
      return c.json({ ok: true, id: b?.id ?? path.basename(dir), path: dir });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 400);
    }
  });
  // Branding: name, logo and colors, read from a website or set by hand. Removing it brings back the default look.
  app.get('/api/brand', async (c) => c.json(await readBrand(opts.dataDir)));
  app.post('/api/brand', async (c) => c.json(await saveBrand(opts.dataDir, await c.req.json().catch(() => ({})))));
  app.post('/api/brand/remove', async (c) => { await removeBrand(opts.dataDir); return c.json({ ok: true }); });
  app.post('/api/brand/import', async (c) => {
    const { url } = await c.req.json().catch(() => ({ url: '' }));
    try { return c.json(await importBrand(String(url ?? '').trim())); }
    catch (e) { return c.json({ error: 'Could not read that website: ' + (e instanceof Error ? e.message : String(e)) }, 400); }
  });
  app.post('/api/brains/:id/alias', async (c) => {
    const b = await brainById(c.req.param('id'));
    if (!b) return c.json({ error: 'not found' }, 404);
    const body = await c.req.json().catch(() => ({}));
    const fields = { alias: String(body.alias ?? ''), role: String(body.role ?? ''), group: String(body.group ?? ''), avatar: body.avatar, model: body.model === undefined ? undefined : String(body.model), skillsOff: body.skillsOff, appsOff: body.appsOff };
    if ([fields.alias, fields.role, fields.group].some((v) => v.trim().length > MAX_ALIAS)) return c.json({ error: `Keep each field under ${MAX_ALIAS} characters.` }, 400);
    await setAlias(opts.dataDir, b.id, fields);
    return c.json({ ok: true });
  });
  app.get('/api/groups', async (c) => c.json(await listGroups(opts.dataDir)));
  app.post('/api/groups', async (c) => {
    const { name } = await c.req.json().catch(() => ({ name: '' }));
    try { await addGroup(opts.dataDir, String(name ?? '')); return c.json({ ok: true }); } catch { return c.json({ error: 'Give the group a name.' }, 400); }
  });
  app.post('/api/groups/rename', async (c) => {
    const { from, to } = await c.req.json().catch(() => ({}));
    try { await renameGroup(opts.dataDir, String(from ?? ''), String(to ?? '')); return c.json({ ok: true }); } catch { return c.json({ error: 'Give the group a name.' }, 400); }
  });
  app.post('/api/groups/delete', async (c) => {
    const { name } = await c.req.json().catch(() => ({ name: '' }));
    await deleteGroup(opts.dataDir, String(name ?? ''));
    return c.json({ ok: true });
  });
  app.post('/api/order', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!Array.isArray(body.ids)) return c.json({ error: 'ids must be a list' }, 400);
    await saveOrder(opts.dataDir, body.ids);
    return c.json({ ok: true });
  });
  app.post('/api/brains/:id/group', async (c) => {
    const b = await brainById(c.req.param('id'));
    if (!b) return c.json({ error: 'not found' }, 404);
    const { group } = await c.req.json().catch(() => ({ group: '' }));
    await moveToGroup(opts.dataDir, b.id, String(group ?? ''));
    return c.json({ ok: true });
  });
  app.post('/api/conversations/:id/delete', async (c) => {
    const conv = await store.get(c.req.param('id'));
    if (!conv) return c.json({ ok: true });
    if (chat.isBusy(conv.brainId)) return c.json({ error: 'That brain is working. Try again when it is done.' }, 409);
    await store.remove(conv.id);
    return c.json({ ok: true });
  });
  app.post('/api/brains/:id/conversations/clear', async (c) => {
    if (chat.isBusy(c.req.param('id'))) return c.json({ error: 'That brain is working. Try again when it is done.' }, 409);
    await store.removeAll(c.req.param('id'));
    return c.json({ ok: true });
  });
  app.post('/api/brains/:id/remove', async (c) => {
    await removeBrainFolder(opts.dataDir, c.req.param('id'));
    return c.json({ ok: true });
  });
  app.get('/api/brains/:id/status', async (c) => {
    const b = await brainById(c.req.param('id'));
    if (!b) return c.json({ error: 'not found' }, 404);
    const me = (c.req.query('who') ?? '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{1,40}$/.test(me) || b.kind === 'project') return c.json({ waiting: [] });
    return c.json({ waiting: await brainStatus(b, `human:${me}`) });
  });
  app.get('/api/brains/:id/conversations', async (c) => c.json(await store.list(c.req.param('id'))));
  app.post('/api/brains/:id/conversations', async (c) => {
    const b = await brainById(c.req.param('id'));
    if (!b) return c.json({ error: 'not found' }, 404);
    const body = await c.req.json().catch(() => ({}));
    return c.json(await store.create(b.id, String(body.title ?? 'New chat')), 201);
  });
  app.get('/api/conversations/:id/transcript', async (c) => c.json(await store.readTranscript(c.req.param('id'))));
  app.post('/api/conversations/:id/messages', async (c) => {
    const conv = await store.get(c.req.param('id'));
    const brain = conv && (await brainById(conv.brainId));
    if (!conv || !brain) return c.json({ error: 'not found' }, 404);
    const body = await c.req.json().catch(() => ({ text: '' }));
    const text = String(body.text ?? '');
    const images: ImageInput[] = (Array.isArray(body.images) ? body.images : [])
      .filter((i: any) => /^image\/(png|jpeg|gif|webp)$/.test(i?.mediaType) && typeof i?.data === 'string' && i.data.length <= 7_000_000)
      .slice(0, 5)
      .map((i: any) => ({ mediaType: i.mediaType, data: i.data }));
    if (!text.trim() && !images.length) return c.json({ error: 'empty message' }, 400);
    const r = await startTurn(brain, conv.id, text, images);
    if (r === 'restarting') return c.json({ error: 'Claude Workspace is restarting. Send it again in a few seconds.' }, 503);
    return r === 'busy' ? c.json({ error: 'brain is busy' }, 409) : c.json({ ok: true }, 202);
  });
  app.post('/api/approvals/:id', async (c) => {
    const { allowed } = await c.req.json().catch(() => ({ allowed: false }));
    return approvals.resolve(c.req.param('id'), allowed === true) ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
  });
  app.post('/api/conversations/:id/files', async (c) => {
    const conv = await store.get(c.req.param('id'));
    const brain = conv && (await brainById(conv.brainId));
    if (!conv || !brain) return c.json({ error: 'not found' }, 404);
    if (chat.isBusy(brain.id)) return c.json({ error: 'brain is busy' }, 409);
    const body = await c.req.parseBody({ all: true });
    const raw = ([] as unknown[]).concat(body.files ?? []).filter((f): f is File => f instanceof File);
    try {
      // Project uploads live in the Workspace folder (uploads/<project>), next to its data folder.
      const uploadsRoot = path.join(path.dirname(opts.dataDir), 'uploads');
      const saved = await saveDrop(brain, await Promise.all(raw.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() }))), uploadsRoot);
      const note = dropMessage(saved, brain.kind);
      // send=no: just save; the files go out with the person's next message instead.
      if (body.send !== 'no') await startTurn(brain, conv.id, note);
      return c.json({ saved, note });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'failed';
      return c.json({ error: code === 'too-many' ? 'Up to 10 files at a time.' : code === 'too-large' ? 'Files must be 50 MB or smaller.' : code }, 400);
    }
  });
  // Restart and shut down never cut a running turn: they wait until no brain is working.
  // Once decided (no brain working), no new turn may start, so nothing can be cut off.
  // A shut down asked for while a restart waits wins.
  let leaving: 'restart' | 'shutdown' | null = null;
  const leave = (mode: 'restart' | 'shutdown') => (c: any) => {
    const go = () => {
      restartDecided = true;
      emit({ type: 'restarting', waiting: false, mode: leaving! });
      setTimeout(leaving === 'shutdown' ? (opts.shutdownFn ?? defaultShutdown) : (opts.restartFn ?? defaultRestart), 50);
    };
    if (restartDecided) return c.json({ waiting: false });
    const first = leaving === null;
    if (leaving !== 'shutdown') leaving = mode;
    if (!chat.anyBusy()) { go(); return c.json({ waiting: false }); }
    emit({ type: 'restarting', waiting: true, mode: leaving });
    if (first) chat.onIdle(go);
    return c.json({ waiting: true });
  };
  app.post('/api/restart', leave('restart'));
  app.post('/api/shutdown', leave('shutdown'));
  app.get('/api/search', async (c) => {
    const q = c.req.query('q') ?? '';
    if (q.trim().length < 2) return c.json([]);
    const list = (await brains()).filter((b) => b.kind !== 'project');
    const graphs = await Promise.all(list.map(async (brain) => ({ brain, graph: await readGraph(brain) })));
    return c.json(searchNotes(graphs, q, c.req.query('brain') ?? ''));
  });
  app.get('/api/brains/:id/checkpoints', async (c) => {
    const b = await brainById(c.req.param('id'));
    if (!b) return c.json({ error: 'not found' }, 404);
    const me = (c.req.query('who') ?? '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{1,40}$/.test(me) || b.kind === 'project') return c.json({ checkpoints: [] });
    return c.json({ checkpoints: await readCheckpoints(b, `human:${me}`) });
  });
  app.get('/api/brains/:id/graph', async (c) => {
    const b = await brainById(c.req.param('id'));
    if (!b) return c.json({ error: 'not found' }, 404);
    return c.json(await readGraph(b));
  });
  app.get('/api/brains/:id/library', async (c) => {
    const b = await brainById(c.req.param('id'));
    return b ? c.json(await listLibrary(b)) : c.json({ error: 'not found' }, 404);
  });
  app.post('/api/open-file', async (c) => {
    const { path: file } = await c.req.json().catch(() => ({ path: '' }));
    try {
      await openWorkspaceFile(opts.brainsRoot, String(file ?? ''));
      return c.json({ ok: true });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Could not open.' }, 400);
    }
  });
  app.post('/api/brains/:id/library/open', async (c) => {
    const b = await brainById(c.req.param('id'));
    if (!b) return c.json({ error: 'not found' }, 404);
    const { path: rel } = await c.req.json().catch(() => ({ path: '' }));
    try {
      openFile(b, String(rel));
      return c.json({ ok: true });
    } catch {
      return c.json({ error: 'outside brain' }, 400);
    }
  });
  app.get('/api/events', (c) =>
    streamSSE(c, async (stream) => {
      const queue: WorkspaceEvent[] = [];
      let wake: (() => void) | null = null;
      const listener = (e: WorkspaceEvent) => { queue.push(e); wake?.(); };
      listeners.add(listener);
      stream.onAbort(() => { listeners.delete(listener); wake?.(); });
      await stream.writeSSE({ event: 'ready', data: '{}' });
      while (!stream.aborted) {
        while (queue.length) await stream.writeSSE({ data: JSON.stringify(queue.shift()) });
        await new Promise<void>((r) => { wake = r; setTimeout(r, 15_000); });
        wake = null;
        if (!queue.length && !stream.aborted) await stream.writeSSE({ event: 'ping', data: '{}' });
      }
    }),
  );

  return { app, emit, store };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  // Brains find the app's tools (for example new-brain) through this.
  process.env.WORKSPACE_HOME ??= path.resolve(config.publicDir, '..');
  process.env.WORKSPACE_BRAINS_ROOT ??= config.brainsRoot;
  const { app } = createApp({ brainsRoot: config.brainsRoot, dataDir: config.dataDir });
  // Always check for a newer page, so an update never hides behind a saved copy.
  app.use('/*', async (c, next) => { await next(); c.header('Cache-Control', 'no-cache'); });
  app.use('/*', serveStatic({ root: path.relative(process.cwd(), config.publicDir) || '.' }));
  serve({ fetch: app.fetch, hostname: '127.0.0.1', port: config.port }, () => {
    const url = `http://127.0.0.1:${config.port}`;
    console.log(`Claude Workspace is running at ${url}`);
    if (process.platform === 'win32' && !process.env.WORKSPACE_NO_OPEN) spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' }).unref();
  });
}
