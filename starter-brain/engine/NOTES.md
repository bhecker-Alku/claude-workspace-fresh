# How to write a note

Read this when creating or reshaping notes (the remember, ingest, correct and consolidate skills point here).

Create notes with `node engine/tools/brain.mjs new-note <domain> <slug> "<Title>" <type>`: it adds the right fields for the type. Then fill `description` and the fields.

```
---
type: decision
title: Switch to drip irrigation
description: One line that says what is in this note. Search, the registers and the graph use it.
domain: garden
status: active        # active, draft, deprecated (feedback: open, applied, dismissed)
date: 2026-11-10
decided_by: lena-ortiz
projects: [spring-plan]
---
# Switch to drip irrigation

The point first, then the detail. Link related notes in the text with [[note-name]].

Sources: [[sources/2026-11-18-committee-minutes]], chat on 2026-11-18
```

## Kinds of note

| type | for | key fields |
| --- | --- | --- |
| fact | something true | |
| person | someone who matters | role, organization, projects |
| organization | a company, funder, agency, group | kind, people |
| project | a piece of work with an end | owner, due, people, risks, decisions |
| decision | what was decided, by whom, when, why | date, decided_by, projects, supersedes |
| risk | what could go wrong | severity (critical/high/medium/low), likelihood, owner, projects, mitigation |
| term | a word, acronym or name with a special meaning | aka |
| question | something still unanswered | owner, projects |
| howto | how something is done | |
| source | a document, page or conversation learned from | date, author |
| hub | a domain's front page | |

## Links carry meaning

Fields like `people`, `owner`, `decided_by`, `projects`, `risks`, `decisions`, `terms`, `organization`, `supersedes`, `related` and `sources` name other notes by file name. They become labeled links in the graph (involves, owned-by, decided-by, part-of, risk, and so on). A plain name with no note yet is fine; the health check lists those so a note can be made when it matters.

## Rules

- One idea per note, file name in lowercase with dashes. Update a note before creating a near-duplicate.
- Keep notes under about 6,000 characters; split bigger ones into linked notes.
- When something stops being true, set `status: deprecated` and link its replacement (`supersedes` / `replaced_by`). Never delete it.
- Every note says where it came from: a `sources` field or a **Sources** line.
- `brain/index.md`, `brain/graph.json` and `brain/registers/` are generated. Never edit them.
