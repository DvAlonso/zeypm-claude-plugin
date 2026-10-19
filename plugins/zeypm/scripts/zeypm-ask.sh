#!/usr/bin/env bash
# zeypm-ask — synchronous PreToolUse hook (matcher: AskUserQuestion) that lets
# you answer the agent's question from your zeypm Agents screen while a zeypm
# tab is in the foreground. Exits 0 with no output whenever it cannot or
# should not hold (feed off, no node, no config, nobody watching), so the CLI
# prompt appears exactly as it always has.
[ "${CLAUDE_PLUGIN_OPTION_LIVE_FEED:-true}" = "false" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0
data="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/zeypm-zeypm}"
[ -f "$data/feed.json" ] || exit 0
exec node "$(cd "$(dirname "$0")" && pwd)/zeypm-ask.mjs"
