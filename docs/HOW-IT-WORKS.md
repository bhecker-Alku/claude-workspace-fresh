# How Claude Workspace works

**One sentence:** a small local web server starts a Claude Code session inside a brain's folder for each chat, and a browser page shows it.

## Pieces

| Part | Where | Job |
| --- | --- | --- |
| Server | `src/server.ts` | Serves the page and the API on 127.0.0.1 only. Rejects other hosts and sites. |
| Brains | `src/brains.ts` | Finds brains (folders with `brain.yaml`), reads their note map, run records and status. Never writes to them. |
| Chat | `src/chat.ts` | Runs one Claude Code turn per brain at a time, on the brain's own folder and rules. |
| Policy | `src/policy.ts` | Decides per tool call: run, ask you first, or block. |
| Team-up | `src/teamup.ts` | Lets a brain ask another brain a read-only question. |
| Page | `public/` | Preact + htm from esm.sh, no build step. |

## Rules it keeps

- **Subscription only.** API-key settings are removed before Claude starts. A session not on a Claude subscription is stopped.
- **The brain decides.** The brain's own `AGENTS.md`, gateways and checkpoints stay in charge. Answers to checkpoints go to the brain as chat messages. The app never edits brain files.
- **Asks first** before pushing, pull requests, deleting, installing, writing outside the brain, or sending anything.
- **One running turn per brain**, because chats share the brain's folder.
- **Restart and Shut down never cut a turn.** They wait until no brain is working.

## Where things are saved

| What | Where |
| --- | --- |
| Chats, nicknames, groups, added brains | `.workspace/` in this folder |
| Files dropped into a project chat | `uploads/<project>/` in this folder |
| Files dropped into a brain chat | that brain's `brain/inbox/` |
| Your name, theme, unread chats | the browser |

None of these go into git.

## Features

Chat with any brain while others work · working dot and unread dot per chat · checkpoint cards with Yes / No / Something else · "what is waiting on you" line · search all notes (Ctrl+K) · note map (Graph) · Library of what a brain made · drop files · team-up between brains · "Update ready" chip that appears only when a restart is needed · hold-to-shut-down ⏻.
