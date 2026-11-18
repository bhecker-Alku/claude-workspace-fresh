---
name: new-brain
description: 'Make a brand-new brain (agent) for Claude Workspace from the brain template - unzip it into a folder named for the agent, next to the other brains, ready to set up. Use when the person says "make a new brain", "create a new agent", "I need a brain for ...", "add a ... to my workspace".'
---

# New brain

1. If the person did not name it, ask: "What should the new brain be called?"
2. From this folder run: `node scripts/new-brain.mjs "<Name>"`. It unzips `templates/brain-template.zip` into `<brains folder>/<name-in-lowercase-with-dashes>` (the folder that holds this app). To put it somewhere else add `--into "<folder>"`; to use another template add `--template "<zip>"`.
3. If the name is taken, ask for another. Never overwrite a folder.
4. Tell the person: the brain is in Claude Workspace's sidebar now; open it and say "set me up". If the app was not running, start it with **Start Claude Workspace**.
