---
name: ingest
description: 'Read documents, meeting notes, transcripts or websites and file what matters into this brain''s memory as linked, typed notes - people, organizations, projects, decisions, risks, terms, facts and open questions. Use when the person says "process the inbox", "file these", "read this", "learn from this document/page/link", drops files in brain/inbox, or pastes a long text to keep.'
---

# Ingest

For each document in `brain/inbox/` (not `processed/`, not `README.md`), or each link or pasted text the person gave:

1. **Read it fully.** PDFs directly; Word and PowerPoint with `node engine/tools/office.mjs text "<file>"`. If a file cannot be read, leave it and say why.
2. **Write one source note:** `brain/sources/YYYY-MM-DD-<short-name>.md` with `type: source`, a one-line `description`, `date` (of the document) and `author`; then what it is, a 5 to 10 bullet summary of what matters to this brain's role, and the original location (`brain/inbox/processed/<file>` or the URL).
3. **Pull out the things, by kind** (fields per kind: `engine/NOTES.md`). Go through the document for each kind and file it (check `brain/registers/` and `brain/index.md` first, and update an existing note before creating one):
   - **people** → `person` notes (role, organization, projects)
   - **organizations** → `organization` notes
   - **projects** → `project` notes (owner, due, people)
   - **decisions** → `decision` notes (date, decided_by, projects, and why)
   - **risks** and concerns → `risk` notes (severity, likelihood, owner, mitigation)
   - **terms**, acronyms, names with a special meaning → `term` notes (aka)
   - **facts**, numbers, dates, rules → `fact` notes or the note they belong to
   - **open questions** → `question` notes (owner)
   Create notes with `node engine/tools/brain.mjs new-note <domain> <slug> "<Title>" <type>`, fill `description` and the fields, and **connect them**: a decision names its `projects` and `decided_by`; a risk its `projects` and `owner`; a project its `people`, `risks` and `decisions`. Use the file names of the notes as values.
4. **Cite.** Add the source to every note you touch: `sources: [sources/YYYY-MM-DD-<short-name>]` in front matter or the **Sources** line.
5. **Conflicts.** If the document contradicts a note, do not overwrite silently: keep both, add a `question` note about the conflict, and tell the person. If it clearly replaces an older decision, create the new decision with `supersedes:` the old one and set the old one `deprecated`.
6. **Move** each filed document to `brain/inbox/processed/`.
7. **Log** one line per document. The index, registers and graph update by themselves when you finish; fix any problem the check reports.
8. **Reply:** each document → counts by kind (e.g. "3 people, 1 project, 2 decisions, 1 risk, 4 terms"), the most important new items, then conflicts or unclear points as questions.

Never delete a document. One idea per note.
