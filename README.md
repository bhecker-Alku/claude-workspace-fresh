# Claude Workspace

A local chat app for your brains. Pick a brain, ask in plain words, and brains bring each other in when a question needs more than one. Claude Code does the work underneath, on your own Claude subscription.

**New here?** Follow [SETUP.md](SETUP.md). **How it works:** [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md).

## Run it

- Windows: double-click **Start Claude Workspace.cmd**.
- Any computer: `npm start` in this folder, or open Claude Code here and say "start my workspace".
- It opens http://127.0.0.1:4317 and keeps running in the background. To turn it off, hold the **⏻** in the top bar (after Library) for a second (or `npm run stop`). When new code is waiting, an **Update ready** chip appears in the top bar; click it to restart.

## Settings

| Variable | Default |
| --- | --- |
| `WORKSPACE_PORT` | `4317` |
| `WORKSPACE_BRAINS_ROOT` | the folder that holds this app; any child folder with a `brain.yaml` is a brain |

## For developers

```
npm install        # with the developer tools
npm test           # all tests
npm run check      # type check
npm run dev        # run in this terminal
```

Add a feature: one server file in `src/` (routes in `src/server.ts`) and one page file in `public/` (imported in `public/app.js`). Colors come from `public/tokens.css`; `tests/style.test.ts` fails on hard-coded colors or text under 12 px in `app.css` and the page scripts. The only other colors are the avatar faces (`jelly.css`) and the graph (`graph.css`).
