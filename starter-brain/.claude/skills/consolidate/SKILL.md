---
name: consolidate
description: 'Make this brain smarter from how it has been used - link notes that keep being used together, add memory paths for questions that needed a search, merge duplicates, fill missing fields, refresh hub summaries, retire stale notes and re-test what it was taught. Use when the person says "consolidate", "get smarter", "learn from our chats", "optimize your memory", "tidy and improve", weekly, or when the health check or catch-me-up suggests it.'
---

# Consolidate

1. **Read the usage record:** `node engine/tools/brain.mjs learn`. It lists the most used notes, notes used together but not linked, questions found only by searching, and notes unused for 90+ days.
2. **Strengthen links** (field names: `engine/NOTES.md`). For each pair "used together but not linked": if they are truly related, add a `[[link]]` in each note's text, or the right relation field (`projects`, `people`, `risks`, `decisions`, `related`). Skip pairs that are only coincidence.
3. **Add memory paths.** For each question "found only by searching", add a row to the curated table at the top of `brain/routing.md`: the kind of question (in general words, not the exact question) → the notes that answered it. Merge rows that overlap; keep the table under about 20 rows.
4. **Promote what matters.** Make sure the most used notes are linked from their domain hub under **Key notes**, and that each hub opens with a 2 to 3 line summary of what the domain knows now. Update those summaries.
5. **Fill the gaps.** Run `node engine/tools/brain.mjs check`. For warnings about missing fields (a risk without severity or owner, a decision without date) fill what you know and list the rest as questions for the person. For names mentioned without a note, create person, organization or project notes for the ones that come up more than once.
6. **Merge and retire.** Merge near-duplicate notes (keep one, mark the other `deprecated` with `replaced_by`). For notes unused for 90+ days that hold dates, deadlines or status, ask whether they are still true; deprecate with a yes.
7. **Re-test.** Run `node engine/tools/brain.mjs evals`; answer each with the **ask** steps and compare with its `expect:`. Fix failures with **correct**.
8. **Finish:** `node engine/tools/brain.mjs refresh` until HEALTHY, then `node engine/tools/brain.mjs consolidated` (resets the weekly reminder). Log one line: `- YYYY-MM-DD: Consolidated: N links, N paths, N merged, tests X/Y.`
9. **Reply** in a few bullets: what got faster (new paths), what got connected, what was merged or retired, test results, and the questions only the person can answer.

Change knowledge only from evidence already in the brain or with the person's yes. Never invent links or facts to make the graph look fuller.
