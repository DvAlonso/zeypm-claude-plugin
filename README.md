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

- **`zeypm-tracking` skill** — how agents keep the project's zeypm tracker
  and Doc Hub current. On first run it *interviews you* about how your
  project works (stage flow, where findings go, doc mirroring, roadmap) and
  stores the confirmed answers in `.claude/zeypm-conventions.md` — committed
  with your repo, editable by hand, and always winning over the skill's
  defaults. It adapts to your tracker's structure; it never imposes one
  (seeding a structure is offered only for an empty tracker with a written
  plan).
- **Stop reminder hook** — fires when a session changed code without a single
  tracker write. Mode is yours: `nudge` (default, non-blocking), `block`, or
  `off`.
- **Session-start context** — a short summary of the tracking contract plus
  your project's conventions file, injected automatically; no CLAUDE.md paste
  needed.
- **`/zeypm:connect` command** — wires the current project to its zeypm MCP
  connection: paste the connection URL, it writes `.mcp.json` for you, then
  `/mcp` completes OAuth.
- **Live feed** (opt-in) — mirrors your Claude Code sessions on zeypm's
  **Agents** screen: what the agent is doing right now, the plan or tracker
  tasks it is working through, the files it touched, a compact log, and the
  questions it asks — which you can answer from zeypm when you have had a
  tab open in the last two minutes. `/zeypm:feed` turns it on per project. See below for exactly
  what is and is not sent.

## Configuration

Set at install time (`--config key=value`) or later via the `/plugin` panel:

- `stop_reminder_mode` — `nudge` (default) · `block` · `off`.
- `inject_context` — `true` (default) · `false` if you keep the tracking
  contract in your own CLAUDE.md.
- `offer_seeding` — `true` (default) · `false` to never be offered a seeded
  tracker structure, even on an empty tracker.
- `live_feed` — `true` (default once a feed token is set up) · `false` to
  stop sending anything from this machine.
- `answer_hold_minutes` — `10` (default): how long the CLI waits for an
  answer from the zeypm screen before asking in the terminal instead.
- `send_message_text` — `true` (default) · `false` to send only the task
  keys found in your prompts and the agent's replies, never the text.

## Connect your project's zeypm MCP

Each connection is scoped and authorized per project, so minting it stays an
in-app step — everything after that is one command:

1. In zeypm, open your project → **MCP** tab → **Connections** and create a
   connection (capability `read_write`; `full` if the agent should seed
   lists and manage docs). Copy the connection URL.
2. Run **`/zeypm:connect`** in Claude Code and paste the URL — it writes the
   project's `.mcp.json`; then `/mcp` completes OAuth in the browser.

Prefer the CLI? `claude mcp add --transport http --scope project zeypm
<connection-url>` does the same thing.

## Live feed: see your sessions in zeypm

Opt in per machine and per project; nothing is sent until you do.

1. In zeypm, open **Settings → Agents → New token**, name it after this
   machine and copy the token (shown once).
2. In the project, run **`/zeypm:feed`** and paste it. If the project talks
   to more than one zeypm server (a dev host and production), it asks which
   one is the tracker.
3. From the next session on, **Agents** appears in zeypm's sidebar. Needs
   Node on this machine and Claude Code 2.1.274 or newer.

What leaves the machine, per event: the tool name and a one-line summary;
for file tools the path and the added/removed line counts; for Bash the
command (bearer tokens, secrets and URL credentials redacted, cut to 300
characters) and a one-line result such as `32 passed`; for tracker calls the
task keys and stage named; your prompts and the agent's end-of-turn replies,
capped at 4096 characters (or only their task keys with
`send_message_text` off). What never does: file contents, edit diffs, command
output, tool results, anything from files the agent read.

When the agent asks you a question and you have had a zeypm tab open in
the last two minutes, the CLI waits for your answer from the screen (up to
`answer_hold_minutes`); press "Hand back to CLI", or stay away from zeypm for
two minutes, and the terminal prompt appears as usual. If zeypm has not seen
you for two minutes when the question comes, the terminal asks right away.
Sessions are private to you and are kept for seven days after they end.

## Updating

Claude Code refreshes marketplaces in the background; new versions apply on
the next session. To force it: `/plugin marketplace update zeypm`.

## About this repo

This repo is a build artifact — the canonical sources live in the zeypm
codebase and are published here by a release script. Issues and ideas are
welcome; code changes land upstream, not via PRs here. MIT licensed.
