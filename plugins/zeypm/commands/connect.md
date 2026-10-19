---
description: Wire this project to its zeypm MCP connection — paste the URL, this writes .mcp.json, then OAuth via /mcp
---

# Connect this project to zeypm

You are wiring the current project to its zeypm MCP connection. The
connection URL is minted in the zeypm app and is unique per project — it
cannot be guessed or generated here.

1. If `.mcp.json` at the project root already has a `zeypm` server entry,
   stop and report that the project is already wired — suggest `/mcp` to
   check or redo authentication. Only replace the URL if the user says it
   changed.
2. Otherwise, ask the user for the connection URL:

   > In zeypm: open the project → **MCP** tab → **Connections** → create a
   > connection (capability `read_write` for day-to-day work; `full` if the
   > agent should also seed lists and manage structure) → copy the URL.

3. Validate it is an `https://` URL. Then write the entry into `.mcp.json`
   at the project root, **merging with any existing content** — never
   clobber other servers in the file:

   ```json
   { "mcpServers": { "zeypm": { "type": "http", "url": "<the url>" } } }
   ```

4. Tell the user to run `/mcp` to complete the OAuth handshake in the
   browser. `.mcp.json` shares only the URL — every teammate authenticates
   individually.
5. Point at what happens next: the first session with the connection live,
   the `zeypm-tracking` skill runs a short interview to learn this project's
   conventions and stores them in `.claude/zeypm-conventions.md`.
6. Offer the live feed: "Want this project's sessions mirrored on your
   zeypm Agents screen (what the agent is doing, live, with questions you
   can answer from there)? Run `/zeypm:feed` — it takes a feed token from
   Settings → Agents." Do not set it up unasked; it is opt-in.
