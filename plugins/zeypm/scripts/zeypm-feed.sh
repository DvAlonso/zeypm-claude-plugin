#!/usr/bin/env bash
# zeypm-feed — async hook wrapper for the live-session feed (agents control
# plane). Registered in hooks.json for every event with "async": true, so
# Claude Code never waits for it. Exits 0 immediately when the feed is off,
# node is missing, or this machine has no feed config; otherwise hands stdin
# to zeypm-feed.mjs, which does the work and swallows every failure.
# Record where the plugin keeps its data so /zeypm:feed can write feed.json there.
[ -n "${CLAUDE_PLUGIN_DATA:-}" ] && [ -d "$HOME/.claude" ] && printf '%s' "$CLAUDE_PLUGIN_DATA" > "$HOME/.claude/zeypm-plugin-data" 2>/dev/null
[ "${CLAUDE_PLUGIN_OPTION_LIVE_FEED:-true}" = "false" ] && exit 0
command -v node >/dev/null 2>&1 || exit 0
data="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/zeypm-zeypm}"
[ -f "$data/feed.json" ] || exit 0
exec node "$(cd "$(dirname "$0")" && pwd)/zeypm-feed.mjs"
