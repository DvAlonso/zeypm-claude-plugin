#!/usr/bin/env bash
# zeypm-tracker-reminder — Stop-hook reminder to keep the zeypm tracker current.
#
# Fires when the session did dev work but never wrote to the zeypm tracker.
# Work is detected from the session TRANSCRIPT (Edit/Write tool calls on source
# files, or a `git commit` run via Bash), not from git state alone — so
# committing before the hook fires does not hide the work. Tracker duty = at
# least one zeypm MCP WRITE call anywhere in the transcript (read-only calls
# like get_workspace don't count). Because the transcript accumulates, one
# tracker write silences all later stops in the session.
#
# Modes (CLAUDE_PLUGIN_OPTION_STOP_REMINDER_MODE — set by the zeypm plugin's
# user config; unset, e.g. for a vendored copy, means "nudge"):
#   nudge — default: emits a non-blocking systemMessage and always exits 0.
#   block — ends the turn only after a tracker write: emits decision:"block"
#           with the reason, so the agent updates the tracker and finishes.
#   off   — does nothing.
# Any parse error just means no reminder. Pairs with the zeypm-tracking skill
# and .claude/zeypm-conventions.md (the actual behavioural contract).
#
# Known false-quiet: if the session Reads a file containing an unescaped
# `"name":"mcp__…zeypm…__create_task"`-shaped string, the duty grep matches.
# Acceptable — it only suppresses a reminder.

mode="${CLAUDE_PLUGIN_OPTION_STOP_REMINDER_MODE:-nudge}"
[ "$mode" = "off" ] && exit 0

# --- Only act in projects actually wired to zeypm: a zeypm server in the
# project's .mcp.json, a zeypm section in CLAUDE.md, a conventions file, or a
# vendored copy of the tracking skill. Keeps the hook silent everywhere else
# when the plugin is enabled at user scope.
proj="${CLAUDE_PROJECT_DIR:-.}"
grep -qsi zeypm "$proj/.mcp.json" "$proj/CLAUDE.md" \
  || [ -f "$proj/.claude/zeypm-conventions.md" ] \
  || [ -d "$proj/.claude/skills/zeypm-tracking" ] \
  || exit 0

payload="$(cat 2>/dev/null)" || exit 0

transcript="$(printf '%s' "$payload" | sed -n 's/.*"transcript_path":"\([^"]*\)".*/\1/p')"
[ -n "$transcript" ] && [ -f "$transcript" ] || exit 0

# --- Tracker duty: any zeypm MCP write tool call recorded in the transcript.
if grep -qE '"name":"mcp__[^"]*zeypm[^"]*__(create_task|update_task|bulk_update_tasks|delete_task|add_comment|update_comment|delete_comment|set_task_tags|add_relation|remove_relation|create_list|update_list|add_stage|rename_stage|reorder_stages|create_doc|update_doc|add_doc_comment|create_article|update_article|create_milestone|update_milestone|create_roadmap_item|update_roadmap_item)"' "$transcript" 2>/dev/null; then
  exit 0
fi

src_ext='ts|tsx|vue|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|sql|css|scss|html'
work=""

# --- Work signal 1: Edit/Write tool calls touching source files. A JSONL entry
# is one line, so the tool name and its input file_path share the line.
if grep -E '"name":"(Edit|Write|NotebookEdit)"' "$transcript" 2>/dev/null \
  | grep -qiE '"file_path":"[^"]*\.('"$src_ext"')"'; then
  work=1
fi

# --- Work signal 2: a git commit made during the session.
if [ -z "$work" ] && grep -E '"name":"Bash"' "$transcript" 2>/dev/null | grep -q 'git commit'; then
  work=1
fi

# --- Fallback: uncommitted source changes still in the tree (pre-commit state,
# or work done by means the transcript greps missed). Skips silently if no git.
if [ -z "$work" ]; then
  cd "$proj" 2>/dev/null || exit 0
  changed="$( { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } \
    | grep -iE '\.('"$src_ext"')$' \
    | grep -viE '(^|/)(docs/|\.claude/)' | head -1 )"
  [ -n "$changed" ] && work=1
fi

if [ -n "$work" ]; then
  if [ "$mode" = "block" ]; then
    printf '%s\n' '{"decision":"block","reason":"zeypm: this session changed code but made no tracker update. Move the task stage, comment the slice, or file findings — per the zeypm-tracking skill and .claude/zeypm-conventions.md — then finish."}'
  else
    printf '%s\n' '{"systemMessage":"zeypm: this session changed code but made no tracker update — move stages / add a comment / file findings per the zeypm-tracking skill."}'
  fi
fi
exit 0
