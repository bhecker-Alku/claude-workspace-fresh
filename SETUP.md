# Set up Claude Workspace

## Once

1. **Install Claude Code** and sign in with your Claude subscription. Claude Workspace uses that sign-in. No API key, no extra billing.
2. **Install Node.js 22 or newer** from nodejs.org or your company software portal.
3. **Put this folder next to your brains:**
   ```
   brains\
     claude-workspace\
     my-brain\
     another-brain\
   ```
   A brain somewhere else? Use **Brain or project** in the sidebar to add it.
4. **Start it.** Windows: double-click **Start Claude Workspace.cmd**. Mac: run `npm start` in this folder. The first start installs what it needs (a few minutes) and tells you if anything is missing.

## Make it yours

- **Branding:** click your name at the bottom left, then **Branding**. Type a website address and press **Read site**: it pulls in the site's name, logo and main colors. Adjust anything, then **Save**. **Remove branding** brings back the default look.
- **Apps and skills:** the round button at the bottom left opens **Connect Apps** (Outlook, Slack, and anything else you connect to Claude) and lists your skills. Each brain's pencil menu can switch skills and apps off for that brain.
- **Adding a ready-made brain:** unzip or copy its folder next to this one and restart; it appears in the sidebar. Give it a name in its pencil menu. Each brain's `START-HERE.md` lists what you can say.
- **Build a team:** each brain is one role. Click **New brain** in the sidebar, or tell any brain "make a new brain called Grant Writer". It makes a fresh brain from `templates/brain-template.zip` in its own folder next to your others, and it appears in the sidebar; open it and say "set me up". Any other folder works too: use **Brain or project**.

## Every day

- Start it the same way, or bookmark http://127.0.0.1:4317 while it runs.
- Done for the day? Hold the **⏻** in the top bar, next to Library, for a second.
- See **Update ready** in the top bar? Click it. Working brains finish first.
- First time in a brain, type the name the brains use for you (for example `sam`), so it can show what waits on you.

## If something is off

| You see | Do this |
| --- | --- |
| "Sign in to Claude Code first" | Open Claude Code, sign in, then press **Try again**. |
| "needs Node.js 22 or newer" | Install Node.js, then start again. |
| No brains in the sidebar | Put brain folders next to this one, then press **Restart**. |

Chats stay on your computer and do not move between computers.
