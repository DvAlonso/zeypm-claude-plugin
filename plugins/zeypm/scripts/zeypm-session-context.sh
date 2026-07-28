#!/usr/bin/env bash
# zeypm-session-context — SessionStart hook. Plain stdout is injected as
# session context; this is the plugin's replacement for the CLAUDE.md snippet
# (plugins cannot ship CLAUDE.md fragments).
cat "$(dirname "$0")/../context/tracking-context.md"
