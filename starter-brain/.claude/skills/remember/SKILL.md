---
name: remember
description: 'Save something from the conversation into this brain''s memory as the right kind of note - a fact, person, organization, project, decision, risk, term, open question or standing preference. Use when the person says "remember that", "note that", "save this", "don''t forget", "from now on", "I prefer", "we decided", "watch out for", or tells the brain something it will need later.'
---

# Remember

1. Pin down exactly what to keep in one or two plain sentences. If unclear, ask one short question.
2. **Decide the kind** (see `engine/NOTES.md` for the fields of each): fact · person · organization · project · decision (who, when, why) · risk (severity, owner) · term (what it means) · question · howto · or a **standing instruction** ("from now on…", "I prefer…").
3. Standing instructions go under **Standing instructions** in `brain/profile.md`.
4. Everything else: look in `brain/registers/` and `brain/index.md` for an existing note and add to it; or create one with `node engine/tools/brain.mjs new-note <domain> <slug> "<Title>" <type>`, fill its `description` and fields, and connect it (`projects`, `people`, `decided_by`, `owner`, …).
5. If it replaces something, update the text and keep `Changed on YYYY-MM-DD: was <old>.`; for a replaced decision, make a new decision note with `supersedes:` and deprecate the old one.
6. Add `chat on YYYY-MM-DD` to the note's sources.
7. Add a log line. The index, registers and graph update by themselves when you finish.
8. Reply in one line: what you saved, as what kind, and where.
