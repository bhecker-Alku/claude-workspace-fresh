---
name: setup
description: 'Give this brain its role and personalize it, for any role the person describes in their own words. Use when the person says "set me up", "set up this brain", "make this a ...", "you are my ...", "change your role", "customize this brain", or when brain/profile.md has status draft and the person agrees.'
---

# Set up this brain

There are no built-in roles. The person describes what they need; you design the brain from that.

1. **Interview, once, in one numbered message.** Ask in plain words, each with a short example to show the kind of answer, not to steer it:
   1. What should I be called?
   2. What role should I play, and what is my job, in a sentence or two?
   3. Who do I work for or with?
   4. What do I need to know well? (the main topics, people, projects or areas)
   5. What will you ask me for most? (questions, tasks, things to write)
   6. How should I talk, and is there anything I must never do?
   Say short answers are fine and they can skip any. If they already described the role in their message, ask only what is missing.
2. **Design the brain from the answers** and show the plan in a short list before writing anything:
   - **Domains:** 3 to 6 topic areas that fit what they need you to know. Use their words for the names.
   - **What to ask:** the things they will ask for most, each under the domain it uses.
   - **Deliverables:** the kinds of things you will write for them, if any.
   - **Memory paths:** for each kind of question they expect, which domain hub to read first.
   - **Limits:** their never-rules, plus: never send, post, buy, contact anyone or delete anything without a yes.
   Ask "Good to go, or change anything?" Apply their changes.
3. **Write the profile.** Rewrite `brain/profile.md`: front matter `type: profile`, `status: active`, `role: <their role in a few words>`; fill every line from their answers; put tone and limits under **Standing instructions**.
4. **Create the domains:** for each, `node engine/tools/brain.mjs new-domain "<Name>" "<what it covers>"`. In each hub, list its items under **What to ask**.
5. **Memory paths:** add one row per expected kind of question to the curated table at the top of `brain/routing.md`.
6. **Test questions:** for each thing they told you that you can already answer (your job, who you help, your tone, your limits), add `brain/evals/<slug>.md` with `type: eval`, `question:`, `expect:`, and `links:` to the note holding the answer.
7. **Name the brain:** set `brain:` in `brain.yaml` to the name in lowercase with dashes, and `role:` to the role. In `START-HERE.md`, replace the text under `## What this brain is` with one sentence: name, role, and who it serves. The app shows that sentence.
8. **Finish:** run `node engine/tools/brain.mjs refresh` and fix any ERROR. Add a log line: `- YYYY-MM-DD: Set up as <name>, <role>.`
9. **Reply in four short lines:** who you are now; your domains; two things to try first (one of their "most asked" items, and "drop documents in brain/inbox and say process the inbox"); and that they can teach you anything with "remember that…", "learn to…", or "set me up" again. Suggest giving the brain the same name in the app's pencil menu.

**Running setup on a brain that is already set up:** show the current profile and domains, ask what to change, and change only that. Never delete notes; rename or merge domains only with a yes.
