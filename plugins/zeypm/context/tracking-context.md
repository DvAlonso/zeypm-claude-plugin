## Task tracking — zeypm (mandatory)

This project's dev backlog lives in the zeypm app, managed through the `zeypm`
MCP server (a per-project connection — every call is already scoped to this
project). The tracker is part of the work, not an afterthought.

- **Invoke the `zeypm-tracking` skill before your first zeypm MCP call of a
  session — and at the start of any session that will change code.** It holds
  the full conventions (the first-run interview, seeding offers, writing
  style, Doc Hub uploads); this section is only the summary.
- **The project's own conventions live in `.claude/zeypm-conventions.md`** —
  written by the skill's first-run interview, editable by hand, injected
  below when present. They override every default here.
- **Keep the tracker current as you work.** Move a task's stage when you start
  and when you finish; comment when a slice lands. A session ends with the
  tracker reflecting reality — never "I'll update it later".
- **Findings never evaporate.** Non-blocking discoveries (bugs, polish items,
  tech debt, deferrals) are filed to the destination the conventions file
  names, the moment they're found.
- **Read the Knowledge base first** (when the module is on) — the project's
  runbook articles beat rediscovering conventions mid-work.
- **Write for humans.** Descriptions and comments are markdown with bullet /
  numbered lists, plain language, no code jargon in the narrative. File
  references only when they genuinely help — and then at the end of the
  comment, as a short bullet list.
- **Plans and specs are mirrored to the Doc Hub** when the project's
  conventions say so.

This plugin's Stop hook reminds you when a session changed code without a
single tracker write (the reminder mode is the user's choice).
