---
name: produce
description: 'Write a deliverable from this brain''s memory - a brief, report, plan, proposal section, memo, email draft, summary, agenda, slide outline or similar - and save it. Use when the person says "write", "draft", "prepare", "make me a", "put together", "create a report/brief/plan".'
---

# Produce

1. **Clarify only what matters:** who it is for, the goal, and length or format if not obvious. One short question at most; otherwise use the profile's defaults.
2. **Gather** with the memory paths (see the **ask** skill): the notes and sources that should shape it. Note gaps you will have to flag.
3. **Write it** in the person's voice and the profile's tone, point first, at the length asked. Use only facts from notes or from the person. Where a fact is missing, leave a clear blank like `[budget amount]` instead of inventing one. This includes small friendly details: never say what someone did, said or how something went unless you have it; write the plain version or leave a blank like `[one thing she did that helped]`. Put a short **Based on** list at the end with the notes used (leave it out of text meant to be copied).
4. **Check it before saving.** Reread against the Truth, Scope and Writing rules in `CLAUDE.md`: remove any invented detail (including compliments or descriptions of events you have no note for), any section or extra they did not ask for, filler openers and closers, stock AI phrases and em dashes. If it reads like a template, rewrite it plainer.
5. **Save** to `brain/deliverables/YYYY-MM-DD-<short-name>.md` with front matter `type: deliverable`, `title`, `description` (what it is and for whom), `status: draft`, `links:` to the main notes used. The app's Library lists it.
6. **Show it.** If it is something the person will copy and paste elsewhere (an email, a post, a short section), also put the text in one ``` fenced block titled with what it is, so the app shows a Copy button.
7. Log it, and list the blanks you left in one or two lines.

Never send or publish it. If the person says it is final, set `status: active`.
