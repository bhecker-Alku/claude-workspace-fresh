---
name: checkpoint
description: 'Pause a multi-step or risky task and wait for the person''s yes before continuing, with a record the app shows as waiting on them. Use before anything irreversible or outside this folder (sending, posting, buying, deleting, contacting someone), for long tasks with several stages, or when the person says "check with me first" or "ask before".'
---

# Checkpoint

1. **Start a run** for any task with more than three steps or any outside action: `node engine/tools/brain.mjs run new <slug> "<goal>"`. It prints the run id.
2. **Record each finished step:** `node engine/tools/brain.mjs run step <id> "<what was done>"`.
3. **Stop before** anything irreversible, anything leaving this folder, or a choice the person should make:
   `node engine/tools/brain.mjs run step <id> "<what is ready>" --await <person> "<the yes/no question>"`.
   Then ask the same question in the chat, with what you will do on yes and on no. Do nothing more on that task until they answer.
4. **On their answer,** record it as a step ("approved by <person>" or "declined: <reason>"), then continue or stop.
5. **Finish:** `node engine/tools/brain.mjs run done <id>`, and log one line.

The app shows open checkpoints as "waiting on you" when the person's name matches. Keep questions short and answerable with yes or no.
