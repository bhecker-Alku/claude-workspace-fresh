---
name: correct
description: 'Fix something the brain got wrong so it stays fixed - correct the note, record the change, add a test question, and fix the procedure if that was the cause. Use when the person says "that''s wrong", "no, actually", "you got X wrong", "that''s out of date", "stop doing X", or disputes an answer.'
---

# Correct

1. **Confirm the fix** in one line ("So the deadline is March 10, not March 3?") unless it is already unambiguous.
2. **Diagnose:** was it the **knowledge** (a note was missing, wrong or out of date) or the **reasoning** (a skill told you to do the wrong thing, or you skipped a step)?
3. **Record it:** `brain/feedback/YYYY-MM-DD-<slug>.md` with `type: feedback`, `status: applied`, `who: <person>`, a one-line `description`, then: what was wrong, what is right, the cause (knowledge or reasoning), what you changed.
4. **Fix the knowledge:** update the note (keep `Changed on YYYY-MM-DD: was <old>.`), or create it; set wrong notes to `status: deprecated` and link the replacement. Add `correction on YYYY-MM-DD` to its Sources.
5. **Fix the reasoning:** if a skill caused it, edit that skill's steps in `.claude/skills/` and say so.
6. **Make it stick:** add `brain/evals/<slug>.md` (`type: eval`, `question:`, `expect:`, `links:` to the fixed note) so the brain can be re-tested on it.
7. **Fix the path** in `brain/routing.md` if you looked in the wrong place.
8. Log it (the brain refreshes itself when you finish). Reply in two lines: what you fixed, and the test you added.

If the person asks for a change you cannot make yet (needs their input or a document), save the feedback note with `status: open` instead, so the app shows it as waiting on them.
