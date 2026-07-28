---
name: zeypm-tracking
description: Use when starting any session that will change code, before calling any zeypm MCP tool, when finishing or advancing a slice of work, when discovering non-blocking issues mid-work, or when producing a plan or spec document — the conventions for keeping this project's zeypm tracker and Doc Hub current.
---

# zeypm tracking conventions

This project's dev backlog lives in the zeypm app, reached through the `zeypm`
MCP server. The connection is per-project — every tool call is already scoped
to this project; there is nothing to select. You are expected to keep the
tracker current *as you work*, not reconstruct it afterwards.

## Session start

1. Call `get_workspace` first. It returns the project's lists (each with its
   stage pipeline) and tags. Every other tool takes these **names** — list
   names, stage names, tag names, member emails — never raw IDs.
2. If no `M<n> - …` milestone lists exist yet, run **Bootstrap** below.
3. Find the task(s) covering the work at hand (`search_tasks` to jump,
   `list_tasks` to browse), or create one. Move it to an in-progress stage when
   you actually start.

## Bootstrap (first run only)

Goal: mirror the project's milestone breakdown into the tracker.

1. Read the development plan / milestone breakdown in `docs/`. If only the
   functional spec exists and there is no milestone breakdown yet, **stop and
   ask the project owner** — never invent milestones.
2. Create one list per milestone via `create_list`, named `M1 - <short name>`,
   `M2 - <short name>`, … Let them inherit the project pipeline; don't invent
   custom stages.
3. Create a `Polish / Deferred` list, and one milestone tag per milestone
   (`M1`, `M2`, …) via `create_tag` — it's idempotent, so re-running bootstrap
   is safe. Don't pass colors unless asked for specific ones.
4. Seed each milestone list with tasks from the breakdown — one task per
   deliverable/slice, with a markdown description (scope summary, acceptance
   sketch) and a priority where the breakdown implies one. Use subtasks
   (`parentKey`) where a slice has clear sub-steps.
5. Wire ordering with `add_relation` (`blocks` / `blocked-by`) where the
   breakdown implies dependencies.
6. Mirror the spec and plan documents into the Doc Hub (see **Docs** below).

**The project owner must pre-create in the app — the MCP cannot:**

- The MCP connection itself (Project → MCP tab → Connections). Capability
  **`full`** for the bootstrap session — `create_list` is gated at `full`;
  steady-state work after bootstrap runs fine on `read_write` if the owner
  prefers to drop privileges afterwards.
- Doc Hub folders (e.g. `Specs`, `Plans`) — there is no create-folder tool.

If a folder you need is missing, ask the project owner. Don't work around it.

## Keeping the tracker current (every session)

- **Stage moves are part of the work.** `update_task` to an in-progress stage
  when starting; when the slice lands, move it forward. Don't batch stage
  moves to the end of the session.
- **Parent/deliverable tasks end at `In review`, never `Done`.** Moving a
  parent to In review triggers an automation that assigns the project owner to review it;
  only they (or the agent after their explicit sign-off) move it to Done.
  The summary comment lands with the In review move. Fine-grained subtasks
  may go straight to Done — their descriptions are the story.
- **Comment per meaningful slice** (`add_comment`) — when you finish or
  meaningfully advance something. Not per file edit, and not a play-by-play.
- **Prefer structure over prose.** Moving a stage, setting a priority, or
  adding a relation beats writing "this is blocked now" in a comment. Add the
  comment too when the *why* needs context.
- **Findings never evaporate.** A mid-work discovery that doesn't block you —
  bug, polish item, tech debt, deliberate deferral — becomes a task in
  `Polish / Deferred`, tagged with the relevant milestone tag (`M1`, `M2`, …),
  filed the moment you find it. A discovery that *does* block you becomes a
  task in the milestone list plus a `blocked-by` relation on the stalled task.
- **Reference, don't repeat.** Mention related tasks by bare key (e.g. `WR-42`,
  whatever this project's key prefix is) in descriptions and comments — keys
  auto-link into reference chips with backlinks. `@member-email` becomes a
  mention chip. To link a **doc**, write `@[doc:<id>]` (the id from `list_docs`
  / `get_doc`) — it becomes a doc reference chip with a backlink. Docs have no
  short key like tasks, so they're addressed by id; an id that isn't a visible
  doc in this project just stays literal text. With the **GitHub module** on,
  `@[pr:owner/repo#123]` / `@[issue:owner/repo#123]` / `@[commit:owner/repo@sha]`
  link PRs, issues, and commits of the project's **connected** repos — same
  rule: unconnected repos and malformed locators stay literal.

## Writing style (descriptions & comments)

Comments and descriptions are read by a human in the app, not by another agent.

- Markdown, formatted: short paragraphs, bullet or numbered lists. Never a
  wall of prose.
- **Titles are plain names** — no numbering prefixes like "Plan task 3 — …";
  the task's key already identifies it, and the pointer to the plan section
  belongs in the description ("Full steps: M1 plan, Task 3").
- **Plain language, no code jargon.** Describe outcomes and behavior ("invite
  links now expire correctly and offer a resend"), not internals ("refactored
  resolveInvite in server/utils").
- File/code references only when they genuinely help the reader — and then at
  the **end** of the comment, as a short bullet list after the narrative:

  > Done: expired invite links now show a clear error page with a resend
  > option.
  >
  > - Also tightened the expiry check that let some stale links through.
  > - Relevant files: `server/api/invites.ts`, `app/pages/invite.vue`

## Roadmap module (when enabled on the project)

The project can mirror its milestone plan into the client-facing **Roadmap**
module. If `get_roadmap` errors with "module is not enabled", skip this — ask
the project owner rather than working around it.

- `get_roadmap` first: the milestone tree with ids — roadmap tools address
  milestones/items **by id** (unlike task tools), since names aren't unique.
- Mirror the same milestones as the task lists (`create_milestone`; sub-parts
  via `parentMilestoneId`, one level max) and one item per deliverable
  (`create_roadmap_item`).
- Keep statuses current as work moves: planned → in_progress → in_review →
  shipped, and **blocked** when something is stuck — a blocked item marks its
  whole milestone blocked on the roadmap, which clients can see (often the
  blocker IS the client — waiting on content or approval).
- Deletes (`delete_milestone` / `delete_roadmap_item`) need the `full`
  capability and `confirm: true`; milestone deletion takes its sub-milestones
  and all items with it.

## GitHub module (when a repo is connected)

If the project has GitHub connected (the tools error with "module is not
enabled" otherwise — ask the project owner rather than working around it), close the loop
between code and tracker:

- **Link the PR back to its task the moment you open one** — an `add_comment`
  with `@[pr:owner/repo#123]` ("Opened @[pr:…] for this"). That mention is what
  `get_linked_prs` reads; a PR that isn't mentioned anywhere is invisible to
  the tracker.
- `get_pr_status` / `get_ci_status` give live PR + CI state — check CI before
  declaring a slice done or moving its task to In review, and say what you saw
  ("CI green, 12 checks") rather than "should be fine".
- `list_recent_commits` orients a cold session on what recently landed.
- `repo` can be omitted when the project has exactly one connected repo; with
  several, pass `repo: "owner/name"`.

## Docs → Doc Hub

Every plan and spec markdown produced for this project is mirrored in the
Doc Hub:

1. `list_folders` → pick the fitting folder (`Specs`, `Plans`, …). If no
   fitting folder exists, ask the project owner — don't dump everything at the root.
2. `create_doc` with the full markdown body; apply doc-tags if fitting ones
   exist.
3. On revisions, `update_doc` — it replaces the **full body** and creates a new
   version. If it's refused because someone is editing the doc live in the
   app, retry shortly; never work around the refusal.

## What the MCP cannot do (ask the project owner instead)

| Need | Why |
|---|---|
| Create ORG-level tags | `create_tag` makes project-level tags only; org tags are app-managed |
| Create Doc Hub folders | No tool; `folderId` must already exist |
| Delete lists, stages, or tags | Not exposed over MCP (archive/rename only) |
| Edit or delete others' comments | Own comments only |

Prefer moving a task to a `discarded`-category stage over `delete_task` —
deletion is permanent and reserved for true mistakes (duplicates, test noise).

## Tool cheat sheet

| Tool | Note |
|---|---|
| `get_workspace` | Always first — lists, stages, tags, by name |
| `list_tasks` / `search_tasks` | Browse (optionally by list/stage) vs jump (top-8 hits) |
| `get_task` | Full detail: description, tags, relations, subtasks, comments |
| `create_task` | List name + tag names; `parentKey` makes a subtask (inherits parent's list) |
| `update_task` | Partial update; moves stage/list/parent; `assignees` by member email |
| `bulk_update_tasks` | One shared patch across ≤50 tasks, all-or-nothing |
| `add_comment` | Markdown auto-converted; bare keys → chips; `@email` → mention |
| `set_task_tags` | REPLACES the full tag set (`[]` clears) |
| `create_tag` | New PROJECT-level tag; idempotent by (name, kind); optional `#RRGGBB` color, kind `task`/`doc` |
| `add_relation` / `remove_relation` | `blocks` / `blocked-by` / `relates`; cycles rejected |
| `create_list` / `update_list` | New list (optional custom pipeline) / rename + archive |
| `add_stage` / `rename_stage` / `reorder_stages` | Edit one list's pipeline (fork-on-write) |
| `create_doc` / `update_doc` | Doc Hub write; update = full-body replace, new version |
| `list_folders` / `list_docs` / `search_docs` / `get_doc` | Doc Hub read |
| `add_doc_comment` | Comment on a doc |
| `get_pr_status` / `get_ci_status` | Live PR state / CI checks rollup (GitHub module, connected repos) |
| `list_recent_commits` | Newest commits of a connected repo |
| `get_linked_prs` | PRs mentioned on a task (`@[pr:…]` chips), resolved live |
