#!/usr/bin/env bash
# zeypm-session-context — SessionStart hook. Plain stdout is injected as
# session context; this is the plugin's replacement for the CLAUDE.md snippet
# (plugins cannot ship CLAUDE.md fragments). When the project has a
# .claude/zeypm-conventions.md (written by the skill's first-run interview),
# it is injected right after the summary, so the project's own conventions
# are always in context.
#
# Only speaks in projects actually wired to zeypm — a zeypm server in the
# project's .mcp.json, a zeypm section in CLAUDE.md, a conventions file, or a
# vendored copy of the tracking skill — so the plugin is safe to enable at
# user scope. CLAUDE_PLUGIN_OPTION_INJECT_CONTEXT=false (plugin user config)
# disables the injection entirely.
proj="${CLAUDE_PROJECT_DIR:-.}"
grep -qsi zeypm "$proj/.mcp.json" "$proj/CLAUDE.md" \
  || [ -f "$proj/.claude/zeypm-conventions.md" ] \
  || [ -d "$proj/.claude/skills/zeypm-tracking" ] \
  || exit 0
[ "${CLAUDE_PLUGIN_OPTION_INJECT_CONTEXT:-true}" = "false" ] && exit 0

cat "$(dirname "$0")/../context/tracking-context.md"

if [ -f "$proj/.claude/zeypm-conventions.md" ]; then
  printf '\n## This project'"'"'s tracking conventions (.claude/zeypm-conventions.md)\n\n'
  cat "$proj/.claude/zeypm-conventions.md"
fi

# userConfig overrides ride along as context so the skill can honor them.
if [ "${CLAUDE_PLUGIN_OPTION_OFFER_SEEDING:-true}" = "false" ]; then
  printf '\nUser setting: never offer to seed a tracker structure — skip the zeypm-tracking skill'"'"'s seeding offer entirely.\n'
fi

# Live feed (agents control plane): the feed hooks need Claude Code 2.1.274 or
# newer. Only checked when this machine has a feed config, so everyone else
# pays nothing. The feed hooks themselves are async and never print.
feed_data="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/plugins/data/zeypm-zeypm}"
if [ -f "$feed_data/feed.json" ] && command -v claude >/dev/null 2>&1; then
  cc_version="$(claude --version 2>/dev/null | head -1 | sed -n 's/^\([0-9][0-9.]*\).*/\1/p')"
  if [ -n "$cc_version" ] && [ "$(printf '%s\n%s\n' "2.1.274" "$cc_version" | sort -V | head -1)" != "2.1.274" ]; then
    printf '\nzeypm live feed is off: it needs Claude Code 2.1.274 or newer (you have %s).\n' "$cc_version"
  fi
fi
