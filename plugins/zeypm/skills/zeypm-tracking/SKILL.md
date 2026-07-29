---
name: zeypm-tracking
description: Use when starting any session that will change code, before calling any zeypm MCP tool, when finishing or advancing a slice of work, when discovering non-blocking issues mid-work, or when producing a plan or spec document — how to keep this project's zeypm tracker and Doc Hub current, and how to learn the project's own conventions instead of assuming them.
---

# zeypm tracking conventions

This project's dev backlog lives in the zeypm app, reached through the `zeypm`
MCP server. The connection is per-project — every tool call is already scoped
to this project; there is nothing to select. You are expected to keep the
tracker current *as you work*, not reconstruct it afterwards.

## How to read this skill

Two kinds of content live here. **Facts** about the MCP — tool mechanics,
capability tiers, what only the project owner can do — are always true.
**Workflow defaults** — where findings go, how stages move, what gets
mirrored — yield, in this order:

1. The project owner's explicit instructions (in `CLAUDE.md` or in chat).
2. The project's stored conventions: `.claude/zeypm-conventions.md` (see
   **First run** below).
3. The structure that already exists in the tracker.
4. This skill's defaults.

Never impose a workflow on a project that has one — work with what's there.
When something seems subpar, **propose** a change and let the owner decide.

## Session start

1. Call `get_workspace` first. It returns the project's lists (each with its
   stage pipeline) and tags. Every other tool takes these **names** — list
   names, stage names, tag names, member emails — never raw IDs.
2. Read `.claude/zeypm-conventions.md` if it exists — it records how this
   project wants stages moved, findings filed, and docs mirrored. If it
   contradicts what `get_workspace` shows (renamed stages, a missing list),
   ask the owner and update the file rather than guessing.
3. No conventions file yet? Run **First run** below before your first write.
4. Find the task(s) covering the work at hand (`search_tasks` to jump,
   `list_tasks` to browse), or create one. Move it to an in-progress stage when
   you actually start.
5. If the Knowledge base module is on, read the relevant runbook articles
   (`list_kb`, `get_article`) before working in an unfamiliar area — that is
   what they exist for.

## First run — learn how this project works

The first session in a project (no `.claude/zeypm-conventions.md` yet),
interview the owner briefly instead of assuming. Ask only what applies,
grounded in what `get_workspace` actually returned:

- **Stages & assignment.** "Your lists use stages X → Y → Z. How should I
  move tasks as I work, and should I assign anyone when I do?"
- **Finishing.** "When I finish something, where should it stop — a review
  stage for your sign-off, or straight to Done?" (No preference? Default to
  leaving final closure to a human.)
- **Findings.** "Where should non-blocking discoveries — bugs, polish items,
  tech debt, deferrals — be filed, and with which tags?"
- **Docs.** "Should plan/spec markdown I produce be mirrored to the Doc Hub,
  and into which folder?"
- **Roadmap** (only if the module is enabled). "Should I keep roadmap item
  statuses in sync as work moves?"
- **Seeding** (only if the tracker is essentially empty — see the next
  section).

Write the confirmed answers to `.claude/zeypm-conventions.md` — short
markdown bullets, committed with the repo so every agent and teammate shares
them. The owner can edit that file directly at any time; it always wins over
this skill's defaults.

## Seeding a tracker structure (an offer, never a default)

Only relevant when the tracker is essentially empty **and** the project has a
written plan or breakdown that decomposes the work into phases/milestones. If
both hold, *offer* to seed — for example: one list per milestone
(`M1 - <short name>`, `M2 - …`), a catch-all list for deferrals, one
milestone tag per phase, one task per deliverable (markdown description,
scope summary, acceptance sketch, subtasks via `parentKey` where a slice has
clear sub-steps), and `blocks` / `blocked-by` relations where the plan
implies ordering.

- That `M<n>` shape is **one** convention, not *the* convention — adapt the
  naming to the owner's vocabulary, and if they prefer a flat backlog or
  their own structure, use that.
- Never invent milestones that aren't in a plan document — ask.
- Never restructure an existing tracker uninvited.
- Record the outcome (including "owner declined — flat backlog") in
  `.claude/zeypm-conventions.md` so later sessions don't re-ask.

Facts that apply when seeding:

- `create_list` is gated at the **`full`** capability; steady-state work after
  seeding runs fine on `read_write` if the owner prefers to drop privileges
  afterwards.
- **The project owner must pre-create in the app — the MCP cannot:** the MCP
  connection itself (Project → MCP tab → Connections), and Doc Hub folders
  (there is no create-folder tool). If something you need is missing, ask —
  don't work around it.

## Keeping the tracker current (every session)

- **Stage moves are part of the work.** `update_task` to an in-progress stage
  when starting; when the slice lands, move it forward — per the project's
  conventions file. Don't batch stage moves to the end of the session.
- **An agent doesn't certify its own work as done.** Follow the finishing
  convention recorded on first run. Some projects automate assignment or
  review handoff when a task enters a given stage (the app's automation
  rules); the conventions file records what this project expects. When in
  doubt, stop at a review stage and let the owner close it.
- **Comment per meaningful slice** (`add_comment`) — when you finish or
  meaningfully advance something. Not per file edit, and not a play-by-play.
- **Prefer structure over prose.** Moving a stage, setting a priority, or
  adding a relation beats writing "this is blocked now" in a comment. Add the
  comment too when the *why* needs context.
- **Findings never evaporate.** A mid-work discovery that doesn't block you —
  bug, polish item, tech debt, deliberate deferral — becomes a task in the
  destination the conventions file names, filed the moment you find it. A
  discovery that *does* block you becomes a task plus a `blocked-by` relation
  on the stalled task.
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

## Writing style (defaults — the owner's taste wins)

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

The project can mirror its plan into the client-facing **Roadmap** module. If
`get_roadmap` errors with "module is not enabled", skip this — ask the
project owner rather than working around it. Whether you maintain the
roadmap at all is a first-run question; only do it when confirmed.

- `get_roadmap` first: the milestone tree with ids — roadmap tools address
  milestones/items **by id** (unlike task tools), since names aren't unique.
- Mirror the project's planning structure (`create_milestone`; sub-parts
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
  declaring a slice done or moving its task to a review stage, and say what you
  saw ("CI green, 12 checks") rather than "should be fine".
- `list_recent_commits` orients a cold session on what recently landed.
- `repo` can be omitted when the project has exactly one connected repo; with
  several, pass `repo: "owner/name"`.

## Docs → Doc Hub (when the project mirrors docs)

Whether plans and specs are mirrored — and where — is a first-run question.
When the conventions file says yes:

1. `list_folders` → pick the fitting folder (`Specs`, `Plans`, …). If no
   fitting folder exists, ask the project owner — don't dump everything at the root.
2. `create_doc` with the full markdown body; apply doc-tags if fitting ones
   exist.
3. On revisions, `update_doc` — it replaces the **full body** and creates a new
   version. If it's refused because someone is editing the doc live in the
   app, retry shortly; never work around the refusal.

## Knowledge base (when enabled on the project)

The KB is the project's runbook — conventions, setup steps, gotchas, written
by the people who know them. If the tools error with "module is not enabled",
ask the project owner rather than working around it.

- `list_kb` is the table of contents (groups and articles, with `status` and
  a derived `stale` flag); `search_kb` searches titles; `get_article` returns
  one article's markdown and editorial state.
- Authoring: `create_article` (markdown only — no file uploads; `nodeKind:
  'group'` makes a contents heading; depth caps at group → article →
  sub-article) and `update_article` (also moves nodes via `parentId` /
  `position`, and sets a review cadence via `reviewEveryDays`).
- **Agent-created articles are drafts.** There is deliberately no publish or
  mark-reviewed tool: asserting that content is correct *today* is a person's
  call. Write the draft, then point the project owner at it.
- A `stale` node's review cadence has lapsed — treat its content with
  suspicion and flag it; don't silently trust or rewrite it.

## What the MCP cannot do (ask the project owner instead)

| Need | Why |
|---|---|
| Create ORG-level tags | `create_tag` makes project-level tags only; org tags are app-managed |
| Create Doc Hub folders | No tool; `folderId` must already exist |
| Delete lists, stages, or tags | Not exposed over MCP (archive/rename only) |
| Edit or delete others' comments | Own comments only |
| Publish or mark-reviewed a KB article | Deliberate: asserting content is correct today is a person's call |

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
| `list_kb` / `search_kb` / `get_article` | KB reads: contents tree / title search / one article (module-gated) |
| `create_article` / `update_article` | KB authoring — markdown drafts; update also moves nodes, sets review cadence |
| `get_roadmap` | Milestone tree with ids — roadmap tools address by **id** (module-gated) |
| `create_milestone` / `update_milestone` | Roadmap milestones; sub-milestones one level max |
| `create_roadmap_item` / `update_roadmap_item` | Roadmap items; keep statuses current as work moves |
| `delete_milestone` / `delete_roadmap_item` | `full` capability + `confirm: true`; milestone delete cascades |
| `update_comment` / `delete_comment` | Own comments only; delete is permanent (`full` capability) |
| `delete_task` | Permanent, `full` capability — prefer a discarded-category stage; true mistakes only |
