/**
 * priorityEngine.js
 *
 * Phase 6: Transparent, deterministic priority/relevance scoring for all 20 clients.
 *
 * GOVERNANCE:
 *   - No mysterious AI scores. Every score is a sum of named factor components.
 *   - Returns score components so the frontend can explain WHY THIS CLIENT IS #1.
 *   - Basic prioritisation applied across all 20 clients.
 *   - Deep bespoke analysis only for CL-0014, CL-0019, CL-0003.
 */

import { loadAllData } from './dataLoader.js'
import {
  getClientAggregatedPortfolio,
  getHoldingsAtSnapshot,
  LATEST_SNAPSHOT,
} from './snapshotEngine.js'
import { getLauChiMingIntelligence } from './lauIntelligence.js'
import { getAbdullahIntelligence } from './abdullahIntelligence.js'
import { getMargartheIntelligence } from './margaretheIntelligence.js'

// The three presentation clients receive deep, bespoke analysis. Their
// authoritative priority score + factors come from their dedicated modules,
// NOT the basic scorer, so the dashboard ranking is consistent with the
// detail pages. All other clients use the transparent basic scorer.
// (Safe: the deep modules import only snapshotEngine + dataLoader, never this
// file, so there is no circular dependency.)
const DEEP_CLIENT_SCORERS = {
  'CL-0014': getLauChiMingIntelligence,
  'CL-0019': getAbdullahIntelligence,
  'CL-0003': getMargartheIntelligence,
}

// ─── Scoring Weights ───────────────────────────────────────────────────────────

const WEIGHTS = {
  liquidityUrgency: 25,       // Confirmed cash need within 90 days
  liquidityModerate: 15,      // Confirmed cash need within 180 days
  mandateBreach: 30,          // Active mandate/suitability breach
  mandateWarning: 15,         // Mandate approaching limit
  creditCritical: 25,         // Credit facility within 5ppts of margin call
  creditWarning: 15,          // Credit facility within 15ppts of margin call
  concentrationHigh: 20,      // Single sector/issuer >50% (or >2x mandate max)
  concentrationMedium: 10,    // Single sector/issuer between 1x and 2x mandate max
  cadenceOverdue: 10,         // Contact cadence overdue
  lifeEvent: 15,              // Active life event (inheritance, succession, etc.)
  scenarioExposure: 10,       // Exposure to an active authoritative event scenario
  objectiveMisalignment: 20,  // Formal objective on record that is not being met
}

// ─── Basic Scoring for All Clients ────────────────────────────────────────────

/**
 * Runs basic scoring for a single client using available data.
 * Returns a transparent score breakdown.
 */
function scoreClient(clientId, snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const client = store.clientById[clientId]
  if (!client) return null

  const factors = {}
  const factorNotes = {}
  let totalScore = 0

  // 1. Liquidity urgency
  const cashNeeds = store.cashNeedsByClient[clientId] || []
  const today = new Date(snapshotDate)

  const confirmedNeedsWithin90 = cashNeeds.filter(cn => {
    if (cn.status !== 'Confirmed') return false
    const due = new Date(cn.due_date)
    const days = Math.round((due - today) / (1000 * 60 * 60 * 24))
    return days <= 90 && days >= 0
  })
  const confirmedNeedsWithin180 = cashNeeds.filter(cn => {
    if (cn.status !== 'Confirmed') return false
    const due = new Date(cn.due_date)
    const days = Math.round((due - today) / (1000 * 60 * 60 * 24))
    return days > 90 && days <= 180
  })

  if (confirmedNeedsWithin90.length > 0) {
    const score = WEIGHTS.liquidityUrgency
    factors.liquidityUrgency = score
    totalScore += score
    factorNotes.liquidityUrgency = `${confirmedNeedsWithin90.length} confirmed cash need(s) within 90 days`
  } else if (confirmedNeedsWithin180.length > 0) {
    const score = WEIGHTS.liquidityModerate
    factors.liquidityModerate = score
    totalScore += score
    factorNotes.liquidityModerate = `${confirmedNeedsWithin180.length} confirmed cash need(s) within 180 days`
  }

  // 2. Credit facility proximity
  const creditFacilities = store.creditFacilitiesByClient[clientId] || []
  const criticalFacilities = creditFacilities.filter(cf =>
    typeof cf.ltv_margin_call_pct === 'number' &&
    typeof cf.ltv_current_pct === 'number' &&
    (cf.ltv_margin_call_pct - cf.ltv_current_pct) <= 5
  )
  const warningFacilities = creditFacilities.filter(cf =>
    typeof cf.ltv_margin_call_pct === 'number' &&
    typeof cf.ltv_current_pct === 'number' &&
    (cf.ltv_margin_call_pct - cf.ltv_current_pct) > 5 &&
    (cf.ltv_margin_call_pct - cf.ltv_current_pct) <= 15
  )

  if (criticalFacilities.length > 0) {
    const score = WEIGHTS.creditCritical
    factors.creditCritical = score
    totalScore += score
    factorNotes.creditCritical = `${criticalFacilities.length} credit facility within 5ppts of margin-call threshold`
  } else if (warningFacilities.length > 0) {
    const score = WEIGHTS.creditWarning
    factors.creditWarning = score
    totalScore += score
    factorNotes.creditWarning = `${warningFacilities.length} credit facility within 15ppts of margin-call threshold`
  }

  // 3. Mandate checks — basic equity ceiling check
  const mandate = store.mandateByClient[clientId]
  if (mandate) {
    const aggPortfolio = getClientAggregatedPortfolio(clientId, snapshotDate)
    const equityAlloc = aggPortfolio.allocation.find(a => a.assetClass === 'Equity')
    const equityPct = equityAlloc?.weightPct || 0

    if (typeof mandate.equity_max_pct === 'number') {
      if (equityPct > mandate.equity_max_pct + 5) {
        const score = WEIGHTS.mandateBreach
        factors.mandateBreach = score
        totalScore += score
        factorNotes.mandateBreach = `Equity ${equityPct}% vs mandate max ${mandate.equity_max_pct}% (breach: +${Math.round((equityPct - mandate.equity_max_pct) * 10) / 10}ppts)`
      } else if (equityPct > mandate.equity_max_pct) {
        const score = WEIGHTS.mandateWarning
        factors.mandateWarning = score
        totalScore += score
        factorNotes.mandateWarning = `Equity ${equityPct}% approaching mandate max ${mandate.equity_max_pct}%`
      }
    }

    // Single sector max check
    const maxSectorPct = mandate.max_single_sector_pct
    if (typeof maxSectorPct === 'number') {
      const portfolios = store.portfoliosByClient[clientId] || []
      for (const pf of portfolios) {
        const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)
        const total = holdings.reduce((s, h) => s + (h.market_value_chf || 0), 0)
        const bySector = {}
        for (const h of holdings) {
          const inst = store.instrumentById[h.instrument_id]
          const sector = inst?.sector || h.sub_class || 'Unknown'
          bySector[sector] = (bySector[sector] || 0) + (h.market_value_chf || 0)
        }
        for (const [sector, val] of Object.entries(bySector)) {
          const pct = total > 0 ? (val / total) * 100 : 0
          if (pct > maxSectorPct * 2 && !factors.concentrationHigh) {
            factors.concentrationHigh = WEIGHTS.concentrationHigh
            totalScore += WEIGHTS.concentrationHigh
            factorNotes.concentrationHigh = `${sector} sector at ${Math.round(pct)}% (>2x mandate max of ${maxSectorPct}%)`
          } else if (pct > maxSectorPct && !factors.concentrationMedium && !factors.concentrationHigh) {
            factors.concentrationMedium = WEIGHTS.concentrationMedium
            totalScore += WEIGHTS.concentrationMedium
            factorNotes.concentrationMedium = `${sector} sector at ${Math.round(pct)}% (above mandate max of ${maxSectorPct}%)`
          }
        }
      }
    }
  }

  // 4. Contact cadence
  if (client.last_contact_date && client.contact_cadence_days) {
    const lastContact = new Date(client.last_contact_date)
    const daysSince = Math.round((today - lastContact) / (1000 * 60 * 60 * 24))
    if (daysSince > client.contact_cadence_days) {
      const score = WEIGHTS.cadenceOverdue
      factors.cadenceOverdue = score
      totalScore += score
      factorNotes.cadenceOverdue = `Last contact ${daysSince} days ago vs ${client.contact_cadence_days}-day cadence (${daysSince - client.contact_cadence_days} days overdue)`
    }
  }

  // 5. Life events — check RM notes for life event type
  const rmNotes = store.rmNotesByClient[clientId] || []
  const hasActiveLifeEvent = rmNotes.some(n =>
    n.note_type === 'Life Event' && n.action_required === true
  )
  if (hasActiveLifeEvent) {
    const score = WEIGHTS.lifeEvent
    factors.lifeEvent = score
    totalScore += score
    factorNotes.lifeEvent = 'Active life-event noted requiring action'
  }

  // 6. Scenario exposure — clients with shipping/energy or HK property exposure
  // Check relevant events from event_log
  const recentHighEvents = store.raw.eventLog.filter(e =>
    e.authoritative === true &&
    e.severity === 'High' &&
    new Date(e.event_date) >= new Date('2026-01-01')
  )

  const portfolios = store.portfoliosByClient[clientId] || []
  let hasScenarioExposure = false
  for (const pf of portfolios) {
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)
    for (const h of holdings) {
      const inst = store.instrumentById[h.instrument_id]
      if (!inst) continue
      const sectorStr = (inst.sector || '') + ' ' + (inst.sub_class || '')
      // HK property exposure → tariff/trade events relevant
      if (sectorStr.toLowerCase().includes('real estate') && sectorStr.toLowerCase().includes('hong kong')) {
        hasScenarioExposure = true
        break
      }
      // Shipping/energy → Hormuz relevant
      if (sectorStr.toLowerCase().includes('shipping') || sectorStr.toLowerCase().includes('energy')) {
        hasScenarioExposure = true
        break
      }
      // Semiconductor → export control event relevant
      if (sectorStr.toLowerCase().includes('semiconductor')) {
        hasScenarioExposure = true
        break
      }
    }
    if (hasScenarioExposure) break
  }

  if (hasScenarioExposure) {
    const score = WEIGHTS.scenarioExposure
    factors.scenarioExposure = score
    totalScore += score
    factorNotes.scenarioExposure = 'Portfolio has exposure to sectors with recent high-severity authoritative events'
  }

  // 7. Objective misalignment — check RM notes
  const hasObjectiveMisalignmentNote = rmNotes.some(n =>
    n.tags && (n.tags.includes('diversification-objective') || n.tags.includes('mandate-breach'))
    && n.action_required === true
  )
  if (hasObjectiveMisalignmentNote) {
    const score = WEIGHTS.objectiveMisalignment
    factors.objectiveMisalignment = score
    totalScore += score
    factorNotes.objectiveMisalignment = 'RM note records active objective misalignment or mandate concern requiring action'
  }

  return {
    clientId,
    clientName: client.full_name,
    segment: client.segment,
    snapshotDate,
    priorityScore: Math.min(100, totalScore),
    priority: totalScore >= 70 ? 'critical' : totalScore >= 50 ? 'high' : totalScore >= 30 ? 'medium' : 'low',
    scoreComponents: factors,
    factorNotes,
    topFactor: Object.entries(factors).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    whyThisClient: Object.entries(factorNotes)
      .sort((a, b) => (factors[b[0]] || 0) - (factors[a[0]] || 0))
      .map(([key, note]) => `[${factors[key]}pts] ${note}`),
  }
}

// ─── Score All Clients ─────────────────────────────────────────────────────────

/**
 * Returns the authoritative score for a client: deep-module score for the
 * three presentation clients, basic score for everyone else. Output shape is
 * identical for both so the ranking/frontend can treat them uniformly.
 */
function scoreClientAuthoritative(clientId, snapshotDate = LATEST_SNAPSHOT) {
  const deepScorer = DEEP_CLIENT_SCORERS[clientId]
  if (!deepScorer) return scoreClient(clientId, snapshotDate)

  const store = loadAllData()
  const client = store.clientById[clientId]
  const raw = deepScorer(snapshotDate)
  const factors = raw.priorityFactors || {}

  // Human-readable notes: prefer the deep signals' titles, fall back to factor names.
  const factorNotes = {}
  for (const key of Object.keys(factors)) {
    factorNotes[key] = humaniseFactor(key)
  }
  const whyThisClient = (raw.signals || [])
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .map(s => `[${(s.severity || '').toUpperCase()}] ${s.title}`)

  return {
    clientId,
    clientName: raw.clientName || client?.full_name,
    segment: client?.segment,
    snapshotDate,
    analysisDepth: 'deep',
    priorityScore: Math.min(100, raw.priorityScore || 0),
    priority: raw.priority,
    scoreComponents: factors,
    factorNotes,
    topFactor: Object.entries(factors).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    whyThisClient: whyThisClient.length ? whyThisClient : Object.entries(factors)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `[${v}pts] ${humaniseFactor(k)}`),
  }
}

function humaniseFactor(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, c => c.toUpperCase())
    .trim()
}

function severityRank(sev) {
  return { high: 3, medium: 2, low: 1 }[(sev || '').toLowerCase()] ?? 0
}

export function scoreAllClients(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const scores = store.raw.clients
    .map(c => scoreClientAuthoritative(c.client_id, snapshotDate))
    .filter(Boolean)
    .sort((a, b) => b.priorityScore - a.priorityScore)

  return {
    snapshotDate,
    totalClients: scores.length,
    prioritisedList: scores,
    topPriorityClientId: scores[0]?.clientId || null,
    criticalCount: scores.filter(s => s.priority === 'critical').length,
    highCount: scores.filter(s => s.priority === 'high').length,
    mediumCount: scores.filter(s => s.priority === 'medium').length,
    lowCount: scores.filter(s => s.priority === 'low').length,
  }
}

export { scoreClient, scoreClientAuthoritative }
