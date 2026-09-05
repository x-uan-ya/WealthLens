// Data access layer.
//
// This is the single seam between the UI and its data source. Today it returns
// mock data synchronously wrapped in Promises. To move to a real REST API,
// replace the bodies of these functions with fetch() calls to your endpoints,
// keeping the same signatures and return shapes. The UI never imports the mock
// files directly, so nothing else needs to change.

import { relationshipManager } from '../data/rm.js'
import { clients } from '../data/clients.js'
import { portfolios } from '../data/portfolios.js'
import { intelligenceSignals } from '../data/intelligence.js'
import { briefings } from '../data/briefings.js'
import { marketSnapshot, marketNarratives } from '../data/market.js'
import { notifications as seedNotifications } from '../data/notifications.js'
import { preferenceSchema, defaultPreferences } from '../data/preferences.js'
import {
  normaliseRm,
  normaliseClient,
  indexPriority,
  normaliseIntelligence,
  normaliseScenario,
  normaliseBrief,
} from './apiNormalise.js'

// Base path for the intelligence-engine API. Relative so the Vite dev proxy
// (and any production reverse proxy) forwards /api/* to the Express server.
const API_BASE = import.meta.env?.VITE_API_BASE || ''

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`)
  return res.json()
}

// Simulate latency so loading states are realistic. Set to 0 to disable.
const LATENCY_MS = 0

const resolve = (value) =>
  new Promise((res) => {
    if (LATENCY_MS > 0) setTimeout(() => res(value), LATENCY_MS)
    else res(value)
  })

const clone = (value) => JSON.parse(JSON.stringify(value))

// --- Relationship Manager ---
export const getRelationshipManager = () => resolve(clone(relationshipManager))

// --- Clients ---
export const getClients = () => resolve(clone(clients))

export const getClientById = (id) =>
  resolve(clone(clients.find((c) => c.id === id) || null))

// --- Portfolios ---
export const getPortfolio = (clientId) =>
  resolve(clone(portfolios[clientId] || null))

export const getAllPortfolios = () => resolve(clone(portfolios))

// --- Intelligence ---
export const getIntelligence = () => resolve(clone(intelligenceSignals))

export const getIntelligenceForClient = (clientId) =>
  resolve(clone(intelligenceSignals.filter((s) => s.clientId === clientId)))

// Returns a single signal, enriched with detail-view fields. Where a signal
// has not been hand-authored with full detail (relevance factors, evidence,
// etc.), sensible defaults are derived from the fields it does have, so the
// Intelligence Detail page works for every signal.
export const getIntelligenceById = (id) => {
  const raw = intelligenceSignals.find((s) => s.id === id)
  if (!raw) return resolve(null)
  return resolve(clone(enrichSignal(raw)))
}

function enrichSignal(s) {
  const relevanceFactors = s.relevanceFactors || deriveFactors(s)
  return {
    ...s,
    relevanceFactors,
    whatChanged: s.whatChanged || s.trigger,
    whyClient: s.whyClient || s.signals || [],
    whyItMatters: s.whyItMatters || s.why,
    suggestedPreparation: s.suggestedPreparation || s.suggestedAction,
    evidence: s.evidence || deriveEvidence(s),
  }
}

// Approximate the four contributing factors from the headline metrics when a
// signal has not been authored with an explicit breakdown.
function deriveFactors(s) {
  const base = s.relevanceScore ?? 60
  const exposure = s.exposurePct != null ? Math.min(99, Math.round(s.exposurePct * 1.6 + 40)) : base
  const urgencyByHorizon = { 'This week': 90, 'This month': 74, 'This quarter': 55 }
  return [
    { label: 'Portfolio Exposure', score: clamp(exposure), note: 'Estimated from the exposure this signal concerns.' },
    { label: 'Market Impact', score: clamp(base - 6), note: 'Estimated market sensitivity for this development.' },
    { label: 'Goal Sensitivity', score: clamp(base + 2), note: 'How closely this touches the client\u2019s stated goals.' },
    { label: 'Urgency', score: clamp(urgencyByHorizon[s.horizon] ?? base), note: `Time sensitivity: ${s.horizon}.` },
  ]
}

function deriveEvidence(s) {
  return (s.signals || []).map((line, i) => ({
    title: ['Portfolio Holdings', 'Client Risk Profile', 'Client Goals', 'Market Development'][i] || 'Supporting signal',
    summary: line,
    rows: [],
  }))
}

function clamp(n) {
  return Math.max(1, Math.min(99, Math.round(n)))
}

// --- Briefings ---
export const getBriefings = () => resolve(clone(briefings))

export const getBriefingById = (id) =>
  resolve(clone(briefings.find((b) => b.id === id) || null))

// --- Market ---
export const getMarketSnapshot = () => resolve(clone(marketSnapshot))
export const getMarketNarratives = () => resolve(clone(marketNarratives))

// =============================================================================
// OFFICIAL DATA (Julius Baer challenge) — served by the real intelligence
// engine at /api/*. Responses are normalised to the shapes the existing
// components consume (see apiNormalise.js). No placeholder figures.
// =============================================================================

// Short-lived caches so we don't refetch the roster + priority ranking for
// every client card on the dashboard. Cleared on full reload.
let _priorityCache = null
let _clientsRawCache = null

async function loadPriorityIndex() {
  if (!_priorityCache) {
    const priority = await fetchJson('/api/intelligence/priority')
    _priorityCache = { raw: priority, index: indexPriority(priority) }
  }
  return _priorityCache
}

// Official RM (Priscilla Ong).
export const getOfficialRm = async () => {
  const [rm, clients] = await Promise.all([
    fetchJson('/api/rm'),
    _clientsRawCache ? Promise.resolve(_clientsRawCache) : fetchJson('/api/clients'),
  ])
  _clientsRawCache = clients
  return normaliseRm(rm, clients.length)
}

// The 20-client book, each carrying its current priority from the ranking.
export const getOfficialClients = async () => {
  const [clients, priority] = await Promise.all([
    _clientsRawCache ? Promise.resolve(_clientsRawCache) : fetchJson('/api/clients'),
    loadPriorityIndex(),
  ])
  _clientsRawCache = clients
  return clients.map((c) => normaliseClient(c, priority.index))
}

export const getOfficialClientById = async (id) => {
  const [clients, priority] = await Promise.all([
    _clientsRawCache ? Promise.resolve(_clientsRawCache) : fetchJson('/api/clients'),
    loadPriorityIndex(),
  ])
  _clientsRawCache = clients
  const raw = clients.find((c) => (c.clientId || c.id) === id)
  return raw ? normaliseClient(raw, priority.index) : null
}

// Full contract-shaped intelligence object for a client (null if none).
// Combines /api/clients/:id/intelligence with /api/clients/:id/snapshots.
export const getClientIntelligence = async (id) => {
  let intel
  try {
    intel = await fetchJson(`/api/clients/${id}/intelligence`)
  } catch {
    return null
  }
  if (!intel) return null
  let snapshots = null
  try {
    snapshots = await fetchJson(`/api/clients/${id}/snapshots`)
  } catch {
    snapshots = null
  }
  return normaliseIntelligence(intel, snapshots)
}

// Whether the client has deep intelligence signals.
export const hasClientIntelligence = async (id) => {
  const intel = await getClientIntelligence(id)
  return Boolean(intel && intel.signals && intel.signals.length > 0)
}

// The five official snapshot dates (from the health endpoint).
export const getSnapshotDates = async () => {
  const health = await fetchJson('/api/health')
  return health.snapshots || []
}

// Official aggregated portfolio for a client at the latest snapshot
// (allocation by asset class + per-portfolio breakdown, in USD).
export const getOfficialPortfolio = async (id) => {
  try {
    return await fetchJson(`/api/clients/${id}/portfolio`)
  } catch {
    return null
  }
}

// Official five-snapshot value history for a client (USD totals).
export const getOfficialSnapshots = async (id) => {
  try {
    return await fetchJson(`/api/clients/${id}/snapshots`)
  } catch {
    return null
  }
}

// ─── Official briefings (grounded RM briefs) ─────────────────────────────────
//
// The Briefings page lists one briefing per client that has deep intelligence
// (a grounded brief can be produced). The list loads fast from the priority
// ranking + intelligence check; the full brief body is generated on demand
// (server-side OpenAI when available, deterministic fallback otherwise) via
// generateClientBrief and mapped to the fields the Briefings UI renders.

const MEETING_TYPE_BY_PRIORITY = {
  critical: 'Priority review',
  high: 'Portfolio review',
  medium: 'Check-in',
  low: 'Check-in',
}

// Build the scheduled briefings list from the official book. Only clients with
// deep intelligence get a briefing (those the engine can ground a brief for).
export const getOfficialBriefings = async () => {
  const { raw } = await loadPriorityIndex()
  const ranked = raw?.prioritisedList || []

  // Check which clients actually have intelligence signals (deep clients).
  const withIntel = await Promise.all(
    ranked.map(async (r) => ({ r, has: await hasClientIntelligence(r.clientId) }))
  )
  const deep = withIntel.filter((x) => x.has).map((x) => x.r)

  // Space the meetings out over the coming days for a realistic schedule.
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  return deep.map((r, i) => ({
    id: `BRIEF-${r.clientId}`,
    clientId: r.clientId,
    clientName: r.clientName,
    meetingType: MEETING_TYPE_BY_PRIORITY[(r.priority || '').toLowerCase()] || 'Review',
    priority: normalisePriority(r.priority),
    status: 'Draft',
    scheduledFor: new Date(now + (i + 1) * DAY).toISOString(),
    summary: `${r.clientName} — ${r.whyThisClient?.[0] || 'priority review'}.`,
    _loaded: false,
  }))
}

// Generate + map a client's grounded brief into the enhanced-briefing fields
// the Briefings page renders (situation, whyItMatters, keyEvidence,
// talkingPoints, prep, sources). Returns null if generation fails entirely.
export const getOfficialBriefingContent = async (clientId) => {
  const brief = await generateClientBrief(clientId)
  if (!brief) return null
  const meta = brief._metadata || {}
  return {
    situation: brief.situation || '',
    whyItMatters: brief.whyItMatters || '',
    keyEvidence: (brief.verifiedEvidence || [])
      .map((e) => (typeof e === 'string' ? e : [e.label, e.value].filter(Boolean).join(' — ')))
      .filter(Boolean),
    talkingPoints: brief.discussionPoints || [],
    prep: brief.clientContext
      ? String(brief.clientContext).split('\n').map((s) => s.trim()).filter(Boolean)
      : [],
    sources: deriveBriefSources(brief),
    clientFriendlySummary: brief.clientFriendlySummary || '',
    uncertainty: brief.uncertainty || '',
    generatedBy: meta.source || 'unknown',
    _metadata: meta,
  }
}

// Pull distinct CSV/record sources out of the brief's evidence references.
function deriveBriefSources(brief) {
  const refs = brief.verifiedEvidence || []
  const set = new Set()
  for (const e of refs) {
    const text = typeof e === 'string' ? e : `${e.label || ''} ${e.value || ''}`
    // Grab things that look like a source file (foo.csv / foo.json).
    const matches = text.match(/[\w-]+\.(csv|json)/gi) || []
    matches.forEach((m) => set.add(m))
  }
  return set.size > 0 ? [...set] : ['holdings.csv', 'event_log.csv', 'rm_notes.json']
}

// Book-level composition for the Portfolios page. A SINGLE call to /api/book
// returns the whole official 20-client book (per-client AUM in USD, current
// allocation, YTD from first-vs-latest snapshot, mandate code(s)) plus the
// pre-computed aggregate. This avoids fanning out into 40 per-client requests,
// which was unreliable on serverless and could blank the page.
//
// IMPORTANT: this THROWS on API failure rather than returning an empty book,
// so the page can show an explicit error state instead of a false "S$0".
export const getOfficialBook = async () => {
  const book = await fetchJson('/api/book') // throws on non-2xx (see fetchJson)
  if (!book || !Array.isArray(book.clients)) {
    throw new Error('Book endpoint returned an unexpected shape')
  }
  return {
    clients: book.clients,
    totalAumUsd: book.totalAumUsd,
    aggregateAllocation: book.aggregateAllocation || [],
    clientCount: book.clientCount ?? book.clients.length,
  }
}

// The dashboard priority ranking (raw engine output).
export const getPriorityRanking = async () => {
  const { raw } = await loadPriorityIndex()
  return raw
}

// --- RM brief + human-in-the-loop review status ---
// The brief is a draft for human review; the app never executes from it.
//
// getClientBrief: cheap check used on page load. It does NOT call OpenAI.
// It reports whether a grounded brief CAN be generated for this client
// (i.e. the client has deep intelligence), returning a lightweight marker so
// the "Generate RM Brief" call-to-action appears. The actual grounded brief is
// produced only when the RM clicks generate (generateClientBrief).
export const getClientBrief = async (id) => {
  const cached = _generatedBriefs[id]
  if (cached) return cached
  const canGenerate = await hasClientIntelligence(id)
  return canGenerate ? { _pending: true, status: 'draft' } : null
}

// Actually generates the grounded AI brief via the server (server-side OpenAI).
// Returns null if the AI key is unavailable so the UI degrades gracefully.
const _generatedBriefs = {}
export const generateClientBrief = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/api/clients/${id}/brief`, { method: 'POST' })
    if (!res.ok) return null
    const data = await res.json()
    const brief = normaliseBrief(data)
    if (brief) _generatedBriefs[id] = brief
    return brief
  } catch {
    return null
  }
}

// Brief review status is a frontend workflow concept (gates the client view).
// Held in-memory per client; survives navigation within a session.
const _briefStatus = {}
export const getBriefStatus = (id) => resolve(_briefStatus[id] || 'none')
export const setBriefStatus = (id, status) => {
  _briefStatus[id] = status
  return resolve(status)
}

// --- Notifications ---
// Generic, mock notifications. Read-state is held in a module-level copy so the
// UI can update without a backend. Replace with GET/PATCH /api/notifications.
let notificationState = clone(seedNotifications)

export const getNotifications = () => resolve(clone(notificationState))

export const markNotificationRead = (id) => {
  notificationState = notificationState.map((n) =>
    n.id === id ? { ...n, read: true } : n
  )
  return resolve(clone(notificationState))
}

export const markAllNotificationsRead = () => {
  notificationState = notificationState.map((n) => ({ ...n, read: true }))
  return resolve(clone(notificationState))
}

// --- Preferences (settings) ---
// The schema describes what to render; values hold the current selections.
// Values persist to localStorage so the demo feels real; swap this for
// GET/PUT /api/preferences without touching the UI.
const PREFS_KEY = 'wealthlens.preferences'

const loadPreferences = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null')
    return { ...defaultPreferences, ...(stored || {}) }
  } catch {
    return { ...defaultPreferences }
  }
}

export const getPreferenceSchema = () => resolve(clone(preferenceSchema))

export const getPreferences = () => resolve(loadPreferences())

export const savePreferences = (values) => {
  const merged = { ...loadPreferences(), ...values }
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(merged))
  } catch {
    // Non-fatal in the prototype: fall back to in-memory only.
  }
  return resolve(clone(merged))
}

export const resetPreferences = () => {
  try {
    localStorage.removeItem(PREFS_KEY)
  } catch {
    /* ignore */
  }
  return resolve({ ...defaultPreferences })
}
