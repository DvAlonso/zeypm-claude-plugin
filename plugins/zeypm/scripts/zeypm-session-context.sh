#!/usr/bin/env bash
# zeypm-session-context — SessionStart hook. Plain stdout is injected as
# session context; this is the plugin's replacement for the CLAUDE.md snippet
# (plugins cannot ship CLAUDE.md fragments).
#
# Only speaks in projects actually wired to zeypm — a zeypm server in the
# project's .mcp.json, a zeypm section in CLAUDE.md, or a vendored copy of the
# tracking skill — so the plugin is safe to enable at user scope.
proj="${CLAUDE_PROJECT_DIR:-.}"
grep -qsi zeypm "$proj/.mcp.json" "$proj/CLAUDE.md" \
  || [ -d "$proj/.claude/skills/zeypm-tracking" ] \
  || exit 0

cat "$(dirname "$0")/../context/tracking-context.md"
