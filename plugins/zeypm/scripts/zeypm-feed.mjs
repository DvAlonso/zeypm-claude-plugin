#!/usr/bin/env node
/**
 * zeypm-feed — the zeypm Claude Code plugin's live-session sender.
 *
 * Registered as an ASYNC hook for every Claude Code event (hooks.json; the
 * version-floor notice lives in the synchronous session-context hook). Reads
 * the hook's JSON from stdin, reduces it to one small event, and POSTs it to
 * the zeypm host the project is mapped to. It never slows or blocks the
 * agent: Claude Code does not wait for async hooks, every failure is swallowed
 * (and written to $CLAUDE_PLUGIN_DATA/feed-errors.log), and the exit code is
 * always 0.
 *
 * What leaves the machine (and what never does):
 *  - file tools: the path (relative to the project) and added/removed line
 *    counts from git — never the content, never the old/new strings;
 *  - Bash: the agent's one-line description (else the command), and the
 *    command itself, redacted (bearer tokens, secrets, URL credentials,
 *    known key shapes) and cut to 300 characters; the result as one line;
 *  - tracker tools (the project's zeypm MCP server): the task keys and the
 *    stage named in the input, plus keys found in the response (a created
 *    task's key lives only there) — never the response body;
 *  - your prompt and the end-of-turn message, capped at 4096 characters, or
 *    only the task keys in them when `send_message_text` is off.
 *
 * Config: $CLAUDE_PLUGIN_DATA/feed.json, written by /zeypm:connect and /zeypm:feed:
 *   { "hosts": { "<origin>": { "token": "zpf_…" } },
 *     "projects": { "<cwd>": { "origin": "<origin>", "connectionId": "…", "serverName": "zeypm" } } }
 *
 * Exports the pure pieces for tests; `main()` runs when invoked directly.
 */

import { existsSync, mkdirSync, rmdirSync, readFileSync, writeFileSync, appendFileSync, statSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { join, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Keep in sync with shared/agents/feed-contract.ts (the plugin ships alone).
export const CAPS = { text: 4096, command: 300, summary: 200, path: 512, tool: 120 }
export const MIN_CLAUDE_VERSION = '2.1.274'
const POST_TIMEOUT_MS = 3000
// Prefix shape = the app's own rule for a project key prefix (one letter, then up
// to five letters or digits); the server filters by the org's real prefixes anyway.
const KEY_RE = /(?<![A-Za-z0-9])([A-Z][A-Z0-9]{0,5})-(\d+)(?![0-9A-Za-z])/g

// ─── small helpers ──────────────────────────────────────────────────────────

const cap = (s, n) => (typeof s === 'string' ? (s.length > n ? s.slice(0, n) : s) : '')
const firstLine = (s) => (typeof s === 'string' ? (s.split(/\r?\n/).find(l => l.trim()) ?? '').trim() : '')
const str = (v) => (typeof v === 'string' ? v : undefined)

export function extractKeys(text) {
  const out = []
  const seen = new Set()
  if (typeof text !== 'string') return out
  for (const m of text.matchAll(KEY_RE)) {
    const key = `${m[1]}-${Number.parseInt(m[2], 10)}`
    if (!seen.has(key)) { seen.add(key); out.push(key) }
  }
  return out
}

export function redactCommand(command) {
  let s = typeof command === 'string' ? command : ''
  s = s.replace(/(authorization\s*[:=]\s*)(bearer\s+|basic\s+)?\S+/gi, '$1$2<redacted>')
  s = s.replace(/\b(token|secret|password|passwd|pwd|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key)(\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi, '$1$2<redacted>')
  s = s.replace(/([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^/\s@]+)@/gi, '$1$2:<redacted>@')
  s = s.replace(/\b(zpf_|sk-|ghp_|gho_|ghu_|github_pat_|xox[abp]-|AKIA|glpat-)[A-Za-z0-9_-]{6,}/g, '<redacted>')
  return cap(s.replace(/\s+/g, ' ').trim(), CAPS.command)
}

function relPath(p, cwd) {
  if (typeof p !== 'string' || !p) return undefined
  const rel = cwd && isAbsolute(p) && p.startsWith(cwd.replace(/\/$/, '') + '/') ? relative(cwd, p) : p
  return cap(rel, CAPS.path)
}

/** `git diff --numstat` for one file (added/removed lines vs HEAD); a new file counts its lines. */
export function gitNumstat(path, cwd) {
  try {
    const out = execFileSync('git', ['diff', '--numstat', 'HEAD', '--', path], { cwd, timeout: 1500, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
    const line = out.split('\n').find(l => l.trim())
    if (line) {
      const [a, r] = line.split('\t')
      return { added: Number.parseInt(a, 10) || 0, removed: Number.parseInt(r, 10) || 0 }
    }
    const abs = isAbsolute(path) ? path : join(cwd, path)
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', '--', path], { cwd, timeout: 1500, stdio: 'ignore' })
      return { added: 0, removed: 0 }
    }
    catch {
      if (existsSync(abs) && statSync(abs).size < 5_000_000) {
        const text = readFileSync(abs, 'utf8')
        return { added: text.split('\n').length - (text.endsWith('\n') ? 1 : 0), removed: 0 }
      }
    }
  }
  catch { /* not a git repo, git missing, timeout */ }
  return { added: 0, removed: 0 }
}

/** One line about what a tool returned. */
export function summarizeResult(tool, response) {
  const text = typeof response === 'string'
    ? response
    : response && typeof response === 'object'
      ? [response.stderr, response.stdout, response.error, response.message, contentText(response)].filter(x => typeof x === 'string' && x.trim()).join('\n')
      : ''
  if (tool === 'Bash') {
    // Only RECOGNISED shapes become a result: a pass/fail count, an interrupt,
    // or the first error line (redacted). Arbitrary stdout never ships — a
    // `cat .env` would otherwise leak its first line.
    // The LAST "N passed" / "N failed": vitest prints "Test Files 2 passed"
    // before "Tests 32 passed", and the tests line is the one that matters.
    const last = (re) => { let m = null; for (const x of text.matchAll(re)) m = x; return m }
    const failed = last(/(\d+)\s+failed/g)
    const passed = last(/(\d+)\s+passed/g)
    const stderr = typeof response === 'object' && response ? str(response.stderr) : undefined
    const interrupted = typeof response === 'object' && response ? response.interrupted === true : false
    if (failed) return { status: 'error', result: cap(`${failed[1]} failed${passed ? `, ${passed[1]} passed` : ''}`, CAPS.summary) }
    if (passed) return { status: 'ok', result: cap(`${passed[1]} passed`, CAPS.summary) }
    if (interrupted) return { status: 'error', result: 'interrupted' }
    const err = stderr && /\b(error|fatal|failed|exception)\b/i.test(stderr) ? firstLine(stderr) : ''
    if (err) return { status: 'error', result: cap(redactCommand(err), CAPS.summary) }
    return { status: 'ok', result: undefined }
  }
  if (typeof response === 'object' && response && (response.error || response.is_error)) {
    return { status: 'error', result: cap(redactCommand(firstLine(str(response.error) ?? contentText(response) ?? 'error')), CAPS.summary) }
  }
  return { status: 'ok', result: undefined }
}

function contentText(response) {
  const c = response && Array.isArray(response.content) ? response.content : null
  if (!c) return undefined
  return c.filter(b => b && b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n')
}

/** Task keys a tracker call names in its input (key, keys, parentKey) and its response. */
export function keysFromTrackerCall(tool, input, response) {
  const fromInput = []
  const fromResponse = []
  const i = input && typeof input === 'object' ? input : {}
  for (const f of ['key', 'parentKey']) if (typeof i[f] === 'string') fromInput.push(...extractKeys(i[f]))
  if (Array.isArray(i.keys)) for (const v of i.keys) if (typeof v === 'string') fromInput.push(...extractKeys(v))
  if (Array.isArray(i.updates)) for (const u of i.updates) if (u && typeof u.key === 'string') fromInput.push(...extractKeys(u.key))
  const text = typeof response === 'string' ? response : (response && typeof response === 'object' ? contentText(response) ?? '' : '')
  fromResponse.push(...extractKeys(text))
  // A create names the task it made in the response and, at most, a parent in
  // the input: the made one leads, so the screen files the right task.
  const ordered = /__create_task$/.test(tool) ? [...fromResponse, ...fromInput] : [...fromInput, ...fromResponse]
  const out = []
  const seen = new Set()
  for (const k of ordered) if (k && !seen.has(k)) { seen.add(k); out.push(k) }
  return out
}

// ─── hook input → contract event ────────────────────────────────────────────

function describeTool(tool, input, cwd) {
  const i = input && typeof input === 'object' ? input : {}
  switch (tool) {
    case 'Read': return { summary: `Read ${relPath(i.file_path, cwd) ?? ''}`.trim(), path: relPath(i.file_path, cwd) }
    case 'Edit': case 'Write': case 'MultiEdit': case 'NotebookEdit':
      return { summary: `${tool} ${relPath(i.file_path ?? i.notebook_path, cwd) ?? ''}`.trim(), path: relPath(i.file_path ?? i.notebook_path, cwd), file: true }
    case 'Bash': {
      // Claude Code sends a one-line description with every Bash call; that is
      // what a person wants to read on the canvas. The command (redacted) stays
      // in the payload for the log.
      const command = redactCommand(i.command)
      const description = redactCommand(str(i.description) ?? '')
      return { summary: cap(description || `Bash ${command}`, CAPS.summary), command }
    }
    case 'Grep': return { summary: cap(`Grep ${str(i.pattern) ?? ''}`, CAPS.summary) }
    case 'Glob': return { summary: cap(`Glob ${str(i.pattern) ?? ''}`, CAPS.summary) }
    case 'WebFetch': return { summary: cap(`WebFetch ${str(i.url) ?? ''}`, CAPS.summary) }
    case 'WebSearch': return { summary: cap(`WebSearch ${str(i.query) ?? ''}`, CAPS.summary) }
    case 'Agent': case 'Task':
      return { summary: cap(`Agent ${str(i.description) ?? str(i.subagent_type) ?? ''}`, CAPS.summary), agentType: str(i.subagent_type), agentDescription: cap(str(i.description) ?? '', CAPS.summary) || undefined }
    case 'AskUserQuestion': {
      const qs = Array.isArray(i.questions) ? i.questions : []
      const first = qs[0] && typeof qs[0].question === 'string' ? qs[0].question : 'Question'
      // Carry the questions exactly as the tool got them (only known fields).
      return { summary: cap(first, CAPS.summary), questions: qs.map((q) => {
        const out = { question: str(q.question) ?? '', options: [] }
        if (str(q.header)) out.header = q.header
        if (q.multiSelect === true) out.multiSelect = true
        if (Array.isArray(q.options)) out.options = q.options.map((o) => {
          const opt = { label: str(o.label) ?? '' }
          if (str(o.description)) opt.description = o.description
          return opt
        })
        return out
      }) }
    }
    default: return { summary: cap(tool, CAPS.summary) }
  }
}

function mcpParts(tool) {
  const m = /^mcp__([^_].*?)__(.+)$/.exec(tool)
  return m ? { serverName: m[1], toolName: m[2] } : null
}

function toolEvent(kind, input, ctx) {
  const tool = cap(str(input.tool_name) ?? 'tool', CAPS.tool)
  const ti = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {}
  const cwd = str(input.cwd) ?? ''
  const d = describeTool(tool, ti, cwd)
  const payload = { toolId: str(input.tool_use_id) ?? `${str(input.session_id) ?? 's'}-${input.__seq ?? 0}`, tool, summary: d.summary }
  if (d.path) payload.path = d.path
  if (d.command) payload.command = d.command
  if (d.agentType) payload.agentType = d.agentType
  if (d.agentDescription) payload.agentDescription = d.agentDescription
  if (d.questions) payload.questions = d.questions

  const mcp = mcpParts(tool)
  if (mcp) {
    payload.serverName = mcp.serverName
    payload.tracker = !!ctx.trackerServerName && mcp.serverName === ctx.trackerServerName
    const keys = keysFromTrackerCall(tool, ti, kind === 'tool.post' ? input.tool_response : undefined)
    if (keys.length) payload.keys = keys
    if (typeof ti.stage === 'string') payload.stage = cap(ti.stage, 80)
    payload.summary = cap(`${mcp.toolName}${keys.length ? ' ' + keys.join(' ') : ''}${payload.stage ? ' → ' + payload.stage : ''}`, CAPS.summary)
  }

  if (kind === 'tool.post') {
    const r = summarizeResult(tool, input.tool_response)
    payload.status = r.status
    if (r.result) payload.result = r.result
    if (d.file && d.path) Object.assign(payload, (ctx.numstat ?? gitNumstat)(d.path, cwd))
    if (tool === 'AskUserQuestion') {
      const a = (ti.answers && typeof ti.answers === 'object') ? ti.answers
        : (input.tool_response && typeof input.tool_response === 'object' && input.tool_response.answers && typeof input.tool_response.answers === 'object') ? input.tool_response.answers : null
      if (a && !Array.isArray(a)) payload.answers = Object.fromEntries(Object.entries(a).filter(([, v]) => typeof v === 'string').map(([k, v]) => [cap(k, CAPS.summary), cap(v, CAPS.summary)]))
    }
  }
  if (kind === 'tool.fail') {
    payload.status = 'error'
    const err = firstLine(str(input.error) ?? str(input.message) ?? '')
    if (err) payload.result = cap(err, CAPS.summary)
    if (d.file && d.path) Object.assign(payload, (ctx.numstat ?? gitNumstat)(d.path, cwd))
  }
  return payload
}

function textPayload(text, ctx, promptId) {
  const t = cap(text ?? '', CAPS.text)
  const payload = { text: ctx.sendMessageText === false ? '' : t }
  if (promptId) payload.promptId = promptId
  if (ctx.sendMessageText === false) {
    // Text off: only the task keys travel, and they double as the line the
    // screen shows for this prompt.
    payload.keys = extractKeys(t)
    payload.summary = payload.keys.length ? payload.keys.join(' ') : 'prompt (text not sent)'
  }
  return payload
}

/**
 * Hook input → contract event, or null for hooks the screen does not use.
 * `ctx`: { trackerServerName, sendMessageText, numstat? }.
 */
export function buildEvent(input, ctx, seq) {
  if (!input || typeof input !== 'object') return null
  const at = new Date().toISOString()
  const name = input.hook_event_name
  const withSeq = { ...input, __seq: seq }
  // Each event carries its own id: the server dedupes on it, so two hooks
  // racing for the same seq (parallel tool calls) never lose an event.
  const mk = (kind, payload) => ({ id: randomUUID(), seq, at, kind, payload })
  switch (name) {
    case 'SessionStart': {
      const payload = { source: str(input.source) ?? 'startup', cwd: str(input.cwd) ?? '' }
      if (str(input.model)) payload.model = input.model
      return mk('session.start', payload)
    }
    case 'SessionEnd': return mk('session.end', { reason: str(input.reason) ?? 'other' })
    case 'PostModelSwitch': return mk('session.model', { from: str(input.from_model), to: str(input.to_model) ?? '' })
    case 'PreCompact': return mk('session.compact', { trigger: str(input.trigger) })
    case 'UserPromptSubmit': return mk('turn.prompt', textPayload(str(input.prompt), ctx, str(input.prompt_id)))
    case 'Stop': return mk('turn.stop', textPayload(str(input.last_assistant_message), ctx, str(input.prompt_id)))
    case 'PreToolUse': return mk('tool.pre', toolEvent('tool.pre', withSeq, ctx))
    case 'PostToolUse': return mk('tool.post', toolEvent('tool.post', withSeq, ctx))
    case 'PostToolUseFailure': return mk('tool.fail', toolEvent('tool.fail', withSeq, ctx))
    case 'TaskCreated': return mk('task.created', { taskId: str(input.task_id) ?? '', subject: cap(str(input.task_subject) ?? '', CAPS.summary) })
    case 'TaskCompleted': return mk('task.completed', { taskId: str(input.task_id) ?? '', subject: cap(str(input.task_subject) ?? '', CAPS.summary) })
    case 'Notification': {
      const t = str(input.notification_type)
      if (t === 'permission_prompt') return mk('notify.permission', { message: cap(str(input.message) ?? '', CAPS.summary) || undefined })
      if (t === 'idle_prompt') return mk('notify.idle', {})
      return null
    }
    case 'SubagentStart': return mk('subagent.start', { agentId: str(input.agent_id) ?? '', agentType: str(input.agent_type), description: cap(str(input.description) ?? '', CAPS.summary) || undefined })
    case 'SubagentStop': return mk('subagent.stop', { agentId: str(input.agent_id) ?? '', agentType: str(input.agent_type) })
    default: return null
  }
}

// ─── sequence numbers, config, posting ──────────────────────────────────────

const LOCK_STALE_MS = 5000
const LOCK_WAIT_MS = 3000

function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) } catch { /* no SAB: busy-wait fallback */ const t = Date.now() + ms; while (Date.now() < t) { /* spin */ } }
}

/**
 * 1-based per session, persisted under the plugin's data dir. Hooks run as
 * separate processes and overlap routinely (a fast tool's pre and post,
 * parallel tool calls), so the read-modify-write sits behind a mkdir lock;
 * a stale lock (a crashed hook) is reclaimed after a few seconds.
 */
export function nextSeq(dataDir, sessionId) {
  const dir = join(dataDir, 'sessions')
  mkdirSync(dir, { recursive: true })
  const base = join(dir, String(sessionId).replace(/[^A-Za-z0-9_.-]/g, '_'))
  const file = `${base}.seq`
  const lock = `${base}.lock`
  const deadline = Date.now() + LOCK_WAIT_MS
  for (;;) {
    try { mkdirSync(lock); break }
    catch (err) {
      if (!err || err.code !== 'EEXIST') throw err
      try { if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) { rmdirSync(lock); continue } } catch { /* raced */ }
      if (Date.now() > deadline) break // give up on the lock rather than on the event
      sleepSync(5 + Math.floor(Math.random() * 10))
    }
  }
  let n = 0
  try {
    try { n = Number.parseInt(readFileSync(file, 'utf8'), 10) || 0 } catch { /* first event */ }
    n += 1
    writeFileSync(file, String(n))
  }
  finally {
    try { rmdirSync(lock) } catch { /* already gone */ }
  }
  return n
}

export function loadConfig(dataDir) {
  try { return JSON.parse(readFileSync(join(dataDir, 'feed.json'), 'utf8')) } catch { return null }
}

export function projectFor(config, cwd) {
  const projects = config && config.projects && typeof config.projects === 'object' ? config.projects : {}
  const norm = (p) => String(p).replace(/\/+$/, '')
  const want = norm(cwd)
  for (const [dir, entry] of Object.entries(projects)) {
    if (norm(dir) === want) return entry
  }
  return null
}

function logError(dataDir, message) {
  try { appendFileSync(join(dataDir, 'feed-errors.log'), `${new Date().toISOString()} ${message}\n`) } catch { /* nothing */ }
}

export function versionAtLeast(version, floor) {
  const a = String(version).split('.').map(n => Number.parseInt(n, 10) || 0)
  const b = String(floor).split('.').map(n => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) { if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0) }
  return true
}

async function post(origin, token, body) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS)
  try {
    const res = await fetch(`${origin.replace(/\/$/, '')}/api/agents/feed/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => '')}`.trim())
  }
  finally { clearTimeout(timer) }
}

function readStdin() {
  try { return readFileSync(0, 'utf8') } catch { return '' }
}

export async function main() {
  const dataDir = process.env.CLAUDE_PLUGIN_DATA || join(process.env.HOME || '', '.claude', 'plugins', 'data', 'zeypm-zeypm')
  let input
  try { input = JSON.parse(readStdin()) } catch { return }
  const config = loadConfig(dataDir)
  if (!config) return
  const cwd = str(input.cwd) || process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const project = projectFor(config, cwd)
  if (!project || !project.origin || !project.connectionId) return
  const host = config.hosts && config.hosts[project.origin]
  if (!host || !host.token) return

  const ctx = {
    trackerServerName: str(project.serverName) ?? 'zeypm',
    sendMessageText: process.env.CLAUDE_PLUGIN_OPTION_SEND_MESSAGE_TEXT !== 'false',
  }
  const sessionId = str(input.session_id) ?? 'unknown'
  const event = buildEvent(input, ctx, nextSeq(dataDir, sessionId))
  if (!event) return
  const session = { claudeSessionId: sessionId, cwd, source: input.hook_event_name === 'SessionStart' ? str(input.source) : undefined }
  try {
    await post(project.origin, host.token, { connectionId: project.connectionId, session, events: [event] })
  }
  catch (err) {
    logError(dataDir, `${project.origin} ${event.kind} seq=${event.seq}: ${err && err.message ? err.message : String(err)}`)
  }
}

// Run `main` when this file is the entry point, however the path was spelled
// (the bash wrapper passes a relative path; tests pass an absolute one).
const invokedDirectly = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main().catch(() => {}).finally(() => process.exit(0))
