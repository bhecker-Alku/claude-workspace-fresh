---
name: learn-skill
description: 'Teach this brain a new repeatable procedure by turning a described way of working into a new skill. Use when the person says "learn to", "every time I ask for X do Y", "here''s how I like my weekly report", "make this a routine", "teach you how to", or after doing a task they want repeated the same way.'
---

# Learn a skill

1. **Capture the procedure.** From what they described (or the task just done), list: when to use it (the phrases they will say), the inputs, the numbered steps, which notes or domains it reads, what it produces and where it saves it, and anything to check before acting.
2. **Read it back** as a short numbered list and ask "Save this as a skill?" Change anything they correct.
3. **Save** `.claude/skills/<skill-name>/SKILL.md`:
   ```
   ---
   name: <skill-name>
   description: <what it does>. Use when the person says "<phrase>", "<phrase>".
   ---
   # <Title>
   1. ...
   ```
   Steps name files and notes, never hold facts: facts go in notes (use **remember**), so the skill keeps working when facts change.
4. If it produces something, end the steps with saving to `brain/deliverables/` as the **produce** skill does. If it acts outside the folder, include a **checkpoint** step.
5. Add a row to the hub of the domain it serves, under **What to ask**, and a log line. Run `node engine/tools/brain.mjs refresh`.
6. Reply: the skill's name and the exact phrase to use it. It is available from the next new chat.
