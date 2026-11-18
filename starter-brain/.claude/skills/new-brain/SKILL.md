---
name: new-brain
description: 'Make a brand-new, empty brain (agent) from the brain template, in its own folder next to this one, so it appears in Claude Workspace ready to set up. Use when the person says "make a new brain", "create a new agent", "I need a brain for ...", "add a ... to my team", "spin up another brain".'
---

# New brain

1. **Name.** If the person did not name it, ask one short question: "What should the new brain be called?" (a role or a name, like "Grant Writer").
2. **Create it** with the workspace's tool (it unzips the template into a folder named for the brain, next to the other brains):
   `node "$WORKSPACE_HOME/scripts/new-brain.mjs" "<Name>"`
   If `WORKSPACE_HOME` is empty, find the tool next to this brain: `../claude-workspace/scripts/new-brain.mjs`, or any `../*/scripts/new-brain.mjs`, and run that instead.
3. **If the name is taken,** say so and ask for another. Never overwrite or reuse an existing folder.
4. **Reply in two lines:** the new brain's name, that it is in the sidebar now (click **Restart** only if it does not show), and to open it and say "set me up".

This creates an empty brain. It does not copy this brain's notes or role. Do not set the new brain up from here: setup happens inside the new brain.
