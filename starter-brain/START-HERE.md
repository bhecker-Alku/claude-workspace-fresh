# Start here

## What this brain is

A new brain, not set up yet. Say "set me up" and describe the role you want it to play.

## How to use it

Open this brain in Claude Workspace and talk to it. Things to say:

| Say | What happens |
| --- | --- |
| **set me up** | Describe the role in your own words. It asks a few questions, proposes how it will organize itself, and becomes that role. |
| **process the inbox** | Reads everything you dropped in `brain/inbox/` and files it into its memory. |
| **remember that …** | Saves a fact, decision or preference. |
| **what do you know about …?** | Answers from memory and says which notes it used. |
| **that's wrong, …** | Fixes the note and adds a test so it stays fixed. |
| **write me a …** | Produces a brief, report, plan or draft in `brain/deliverables/`. |
| **catch me up** | What is new, what is waiting on you, what to do next. |
| **consolidate** | Learns from how it has been used: links what belongs together, speeds up memory paths, merges duplicates, re-tests itself. Weekly is ideal. |
| **check your health** | Finds broken links, gaps and stale notes, and fixes them. |
| **learn to …** | Turns a way of working you describe into a new skill it can repeat. |

Click **Graph** in the app to see its memory as a map. It keeps lists of people, organizations, projects, decisions, risks, terms, sources and open questions in `brain/registers/`.

## Any role

Nothing is built in: the brain becomes whatever you describe, and keeps learning from what you tell it, the documents you give it and the corrections you make.

## Build a team

Each brain is one role. To add one, say **"make a new brain called Grant Writer"** to any brain, or click **New brain** in the sidebar. A fresh, empty brain appears in the sidebar; open it and say "set me up". Brains can ask each other questions: mention one with `@` in a chat.

## What is inside

`CLAUDE.md` is how the brain works. `brain/` is its memory. `engine/tools/brain.mjs` keeps the index, memory paths and graph up to date and checks health. `.claude/skills/` are its procedures.
