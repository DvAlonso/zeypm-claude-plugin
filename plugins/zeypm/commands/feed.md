---
description: Mirror this machine's Claude Code sessions on your zeypm Agents screen — paste a feed token, pick the tracker connection, done
---

# Turn on the live feed for this project

You are enabling the zeypm live feed: from now on this project's Claude Code
sessions show up on the person's **Agents** screen in zeypm (what the agent
is doing, the plan or tasks it is working through, the files it touched, and
the questions it asks — which they can answer from there). Nothing is sent
until this is set up; file contents and command output are never sent.

1. Check `node --version` works (Node 18 or newer). If it does not, stop:
   the feed needs Node on this machine. Also check `claude --version` is
   `2.1.274` or newer; older versions do not fire the hooks the feed uses.
2. Find this project's zeypm connection:
   - If `.mcp.json` at the project root has a server whose URL contains
     `/api/mcp/c/`, that is it. Note the **server name** (the key, usually
     `zeypm`) and the **URL**.
   - If there are several such servers (a dev host and production, say), ask
     the user which one is this project's tracker — the feed follows exactly
     one.
   - If there is none in `.mcp.json`, ask the user to paste the connection
     URL (zeypm → project → **MCP** tab → **Connections**) and the name they
     gave the server in their Claude config.
   The **origin** is the URL's scheme and host (`https://zeypm.com`); the
   **connection id** is the path segment after `/api/mcp/c/`.
3. Ask the user for a **feed token**:

   > In zeypm: **Settings → Agents → New token**, name it after this machine,
   > copy it (it is shown once; it starts with `zpf_`).

   The token identifies the person, not the project, so one token covers
   every project on this machine.
4. Work out where the plugin keeps its data: read `~/.claude/zeypm-plugin-data`
   (the plugin's hooks write their data directory there on every session
   start). If that file is missing, use `~/.claude/plugins/data/zeypm-zeypm/` (the plugin name and its marketplace).
   Create the directory if needed.
5. Write or **merge** `feed.json` in that directory — never clobber other
   hosts or projects already in it:

   ```json
   {
     "hosts": { "<origin>": { "token": "<the zpf_ token>" } },
     "projects": {
       "<absolute project path>": { "origin": "<origin>", "connectionId": "<id>", "serverName": "<server name>" }
     }
   }
   ```

   Use the project's absolute path exactly as `pwd` prints it (no trailing
   slash). Set the file's permissions to owner-only (`chmod 600`).
6. Tell the user: the feed starts with the **next** session (hooks read the
   config when they fire); the Agents screen appears in zeypm's sidebar once
   the first event lands; the plugin options `live_feed`,
   `answer_hold_minutes` and `send_message_text` tune it (`/plugin` →
   zeypm → configure); and revoking the token in Settings → Agents stops
   this machine's feed at any time.
