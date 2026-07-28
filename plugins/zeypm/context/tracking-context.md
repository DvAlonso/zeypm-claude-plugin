## Task tracking — zeypm (mandatory)

This project's dev backlog lives in the zeypm app, managed through the `zeypm`
MCP server (a per-project connection — every call is already scoped to this
project). The tracker is part of the work, not an afterthought.

- **Invoke the `zeypm-tracking` skill before your first zeypm MCP call of a
  session — and at the start of any session that will change code.** It holds
  the full conventions (first-run bootstrap, writing style, Doc Hub uploads);
  this section is only the summary.
- **Keep the tracker current as you work.** Move a task's stage when you start
  and when you finish; comment when a slice lands. A session ends with the
  tracker reflecting reality — never "I'll update it later".
- **Findings never evaporate.** Non-blocking discoveries (bugs, polish items,
  tech debt, deferrals) are filed to the `Polish / Deferred` list, tagged with
  their milestone, the moment they're found.
- **Read the Knowledge base first** (when the module is on) — the project's
  runbook articles beat rediscovering conventions mid-work.
- **Write for humans.** Descriptions and comments are markdown with bullet /
  numbered lists, plain language, no code jargon in the narrative. File
  references only when they genuinely help — and then at the end of the
  comment, as a short bullet list.
- **Plans and specs are mirrored to the Doc Hub** in their fitting folder.

This plugin's Stop hook nudges (never blocks) when a session changed code
without a single tracker write.
