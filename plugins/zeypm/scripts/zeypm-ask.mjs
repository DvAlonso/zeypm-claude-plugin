#!/usr/bin/env node
/**
 * zeypm-ask — answer the agent's question from zeypm (agents control plane).
 *
 * The one SYNCHRONOUS hook in the plugin: PreToolUse, matcher AskUserQuestion.
 * It opens the question on the zeypm host this project is mapped to and asks
 * whether the owner is watching (a zeypm tab seen in the last two minutes).
 * If not, it releases the question and exits with no output, so the CLI asks
 * as usual and the screen cannot take an answer nobody will collect. If so,
 * it holds — polling the wait endpoint, which itself releases once the
 * owner's two quiet minutes run out —
 * until the answer arrives, the question is handed back, or its own deadline
 * (`answer_hold_minutes`, default 10) passes. An answer is returned as the
 * tool's input (`updatedInput.answers`), which is the documented way to
 * answer on the user's behalf. Anything else, including every error, means
 * no output and exit 0: the CLI prompt appears unchanged.
 */

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WAIT_HOLD_MS = 20_000
const REQUEST_TIMEOUT_MS = 3000
const DEADLINE_MARGIN_MS = 5000
/** hooks.json registers this hook with a 630 s timeout; the hold never exceeds it. */
export const MAX_HOLD_MS = 600_000

const str = (v) => (typeof v === 'string' ? v : undefined)

function loadConfig(dataDir) {
  try { return JSON.parse(readFileSync(join(dataDir, 'feed.json'), 'utf8')) } catch { return null }
}

function projectFor(config, cwd) {
  const projects = config && config.projects && typeof config.projects === 'object' ? config.projects : {}
  const norm = (p) => String(p).replace(/\/+$/, '')
  for (const [dir, entry] of Object.entries(projects)) if (norm(dir) === norm(cwd)) return entry
  return null
}

async function call(origin, token, method, path, body, timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${origin.replace(/\/$/, '')}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  }
  finally { clearTimeout(timer) }
}

export function holdMs() {
  const minutes = Number.parseFloat(process.env.CLAUDE_PLUGIN_OPTION_ANSWER_HOLD_MINUTES ?? '10')
  const m = Number.isFinite(minutes) && minutes > 0 ? minutes : 10
  return Math.min(MAX_HOLD_MS, Math.max(1000, Math.round(m * 60_000) - DEADLINE_MARGIN_MS))
}

export function answerOutput(toolInput, answers) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: 'Answered from zeypm',
      updatedInput: { ...toolInput, answers },
    },
  }
}

export async function main() {
  const dataDir = process.env.CLAUDE_PLUGIN_DATA || join(process.env.HOME || '', '.claude', 'plugins', 'data', 'zeypm-zeypm')
  let input
  try { input = JSON.parse(readFileSync(0, 'utf8')) } catch { return }
  if (input.hook_event_name !== 'PreToolUse' || input.tool_name !== 'AskUserQuestion') return
  const toolInput = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {}
  if (!Array.isArray(toolInput.questions) || !toolInput.questions.length) return
  if (toolInput.answers && typeof toolInput.answers === 'object') return // already answered upstream

  const config = loadConfig(dataDir)
  if (!config) return
  const cwd = str(input.cwd) || process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const project = projectFor(config, cwd)
  if (!project || !project.origin || !project.connectionId) return
  const host = config.hosts && config.hosts[project.origin]
  if (!host || !host.token) return

  const opened = await call(project.origin, host.token, 'POST', '/api/agents/feed/questions', {
    connectionId: project.connectionId,
    session: { claudeSessionId: str(input.session_id) ?? 'unknown', cwd },
    questions: toolInput.questions,
  }, REQUEST_TIMEOUT_MS)
  if (!opened || !opened.questionId) return
  const id = encodeURIComponent(opened.questionId)
  // Whatever happens below, the question must not stay open on the server
  // while the CLI is asking: every exit that is not a delivered answer (and
  // not a settle the server already recorded) releases it, best effort.
  const release = () => call(project.origin, host.token, 'POST', `/api/agents/feed/questions/${id}/release`, undefined, REQUEST_TIMEOUT_MS).catch(() => {})
  // Nobody watching: the CLI asks right now, so the screen must say so
  // instead of offering an answer nobody will collect.
  if (opened.watching !== true) { await release(); return }

  const deadline = Date.now() + holdMs()
  while (Date.now() < deadline) {
    const hold = Math.max(0, Math.min(WAIT_HOLD_MS, deadline - Date.now()))
    let r
    try {
      r = await call(project.origin, host.token, 'GET', `/api/agents/feed/questions/${id}/wait?hold=${hold}`, undefined, hold + REQUEST_TIMEOUT_MS)
    }
    catch { await release(); return }
    if (!r || typeof r !== 'object') { await release(); return }
    if (r.state === 'answered' && r.answers && typeof r.answers === 'object') {
      process.stdout.write(JSON.stringify(answerOutput(toolInput, r.answers)))
      return
    }
    if (r.state !== 'pending') return // released, expired or answered without answers: already settled server-side
  }
  // Our deadline passed: tell zeypm the CLI is asking now, then stay silent.
  await release()
}

// Run `main` when this file is the entry point, however the path was spelled
// (the bash wrapper passes a relative path; tests pass an absolute one).
const invokedDirectly = !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main().catch(() => {}).finally(() => process.exit(0))
