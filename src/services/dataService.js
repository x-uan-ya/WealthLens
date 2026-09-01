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
