---
name: catch-me-up
description: 'Summarize what is new in this brain and what is waiting on the person - new knowledge, open decisions, top risks, deadlines and checkpoints. Use when the person says "catch me up", "what''s new", "where are we", "what did I miss", "what''s open", "brief me", or starts the day.'
---

# Catch me up

1. Read the newest entries in `brain/log.md` (the last 7 days, or the last 10 entries).
2. Run `node engine/tools/brain.mjs status --who <person>` for open feedback and checkpoints, and `node engine/tools/brain.mjs check` for inbox files waiting.
3. Read `brain/registers/risks.md` (critical and high first), `projects.md` (due dates in the next two weeks), `decisions.md` (the newest) and `open-questions.md`.
4. Reply in three short sections, a few bullets each, naming the note behind each point:
   - **New:** what was added or changed, including new decisions.
   - **Waiting on you:** checkpoints, open questions, decisions to make, unprocessed inbox files, deadlines, high risks without a mitigation.
   - **Next:** the one or two most useful things to do now. If the brain has not been consolidated in a week (check the log), suggest "consolidate".
