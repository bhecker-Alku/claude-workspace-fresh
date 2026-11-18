---
name: health
description: 'Check and repair this brain - broken links, notes without descriptions or sources, orphans, missing hubs, stale or duplicate notes, slow memory paths - and re-test what it was taught. Use when the person says "check your health", "clean up", "tidy your notes", "are you working right", "run your tests", or weekly.'
---

# Health

1. Run `node engine/tools/brain.mjs refresh`. Fix every **ERROR** (broken links, bad types, memory paths to missing notes).
2. Work the **warnings**, most useful first: add missing descriptions and sources (ask if unknown); link orphans to their hub or a related note; create missing hubs; merge near-duplicate titles (with a yes).
3. **Freshness:** list notes with dates or deadlines already past, and drafts older than 30 days; offer to update or deprecate them.
4. **Memory paths:** in `brain/routing.md`, remove rows that point to deprecated notes and merge overlapping rows. Keep the curated table under about 20 rows.
5. **Tests:** run `node engine/tools/brain.mjs evals`. For each, answer the question using only the **ask** skill, then compare with its `expect:`. Report pass or fail. For each failure, use **correct** to fix the note or path.
6. Run `refresh` again until **HEALTHY**. Log one line with the counts.
7. Reply: health before and after (errors / warnings), tests passed, and anything that needs the person. If `node engine/tools/brain.mjs learn` shows links or paths to add, suggest **consolidate**.
