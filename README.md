# zeypm — Claude Code plugin

Agent tooling for projects tracked in [zeypm](https://zeypm.com): the
`zeypm-tracking` skill, a non-blocking Stop reminder hook, and session-start
tracking context. Installing the plugin replaces copy-pasting these files from
the app's Resources tab — updates ship automatically when this repo moves.

## Install

**Just for yourself:**

```
/plugin marketplace add DvAlonso/zeypm-claude-plugin
/plugin install zeypm@zeypm
```

This enables the plugin across all your projects — which is safe: its
session context and reminders only activate in projects that are actually
wired to zeypm (a `zeypm` server in the project's `.mcp.json`, or an existing
vendored setup). Everywhere else it stays silent.

**For the whole team (shared repo):**

```
claude plugin marketplace add DvAlonso/zeypm-claude-plugin --scope project
claude plugin install zeypm@zeypm --scope project
```

Both commands matter: together they record the marketplace
(`extraKnownMarketplaces`) and the plugin (`enabledPlugins`) in the repo's
`.claude/settings.json` — commit that file. Teammates are then offered the
plugin on their first session (workspace trust, then a one-time install
approval in `/plugin`); nothing installs silently, by design. Each teammate
still completes their own MCP OAuth (below).

## What's inside

- **`zeypm-tracking` skill** — the full conventions for keeping the project's
  zeypm tracker and Doc Hub current: session-start routine, first-run
  bootstrap, stage discipline, writing style, what the MCP cannot do.
- **Stop reminder hook** — nudges (never blocks) when a session changed code
  without a single tracker write.
- **Session-start context** — a short summary of the tracking contract,
  injected automatically; no CLAUDE.md paste needed.

## Connect your project's zeypm MCP

The plugin assumes the project has a zeypm MCP connection — that stays a
per-project manual step, because each connection is scoped and authorized
individually:

1. In zeypm, open your project → **MCP** tab → **Connections** and create a
   connection (capability `read_write`; `full` if the agent should bootstrap
   lists and manage docs). Copy the connection URL.
2. Add it to the project, then complete OAuth via `/mcp` inside Claude Code:

   ```
   claude mcp add --transport http --scope project zeypm <connection-url>
   ```

   (`--scope project` shares the server via `.mcp.json`; drop it to keep the
   connection personal.)

## Updating

Claude Code refreshes marketplaces in the background; new versions apply on
the next session. To force it: `/plugin marketplace update zeypm`.

## About this repo

This repo is a build artifact — the canonical sources live in the zeypm
codebase and are published here by a release script. Issues and ideas are
welcome; code changes land upstream, not via PRs here.
