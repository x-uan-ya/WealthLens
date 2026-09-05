/**
 * priorityEngine.js
 *
 * Transparent, deterministic priority/relevance scoring for all 20 clients —
 * OFFICIAL schema.
 *
 * GOVERNANCE:
 *   - No opaque AI scores. Every score is a sum of named factor components.
 *   - Returns score components so the frontend can explain WHY THIS CLIENT IS #1.
 *   - Basic prioritisation across all 20 clients; deep bespoke analysis only for
 *     CL-0014, CL-0019, CL-0003 (their dedicated modules produce the score).
 */

import { loadAllData } from './dataLoader.js'
import {
  getClientAggregatedPortfolio,
  getHoldingsAtSnapshot,
  getClientSectorConcentration,
  LATEST_SNAPSHOT,
} from './snapshotEngine.js'
import { getLauChiMingIntelligence } from './lauIntelligence.js'
import { getAbdullahIntelligence } from './abdullahIntelligence.js'
import { getMargartheIntelligence } from './margaretheIntelligence.js'

const DEEP_CLIENT_SCORERS = {
  'CL-0014': getLauChiMingIntelligence,
  'CL-0019': getAbdullahIntelligence,
  'CL-0003': getMargartheIntelligence,
}

// ─── Scoring Weights ───────────────────────────────────────────────────────────

const WEIGHTS = {
  liquidityUrgency: 25,       // Confirmed cash need within 120 days
  liquidityModerate: 15,      // Confirmed cash need within 240 days
  mandateBreach: 30,          // Equity/asset-class outside mandate band by >5ppts
  mandateWarning: 15,         // Asset class outside mandate band
  creditCritical: 25,         // Facility within 2ppts of margin call
  creditWarning: 15,          // Facility within 10ppts of margin call
  concentrationHigh: 20,      // Single sector/position >2x mandate single max
  concentrationMedium: 10,    // Single position above mandate single max
  scenarioExposure: 10,       // Exposure to sectors hit by Severe/High events
  singlePositionBreach: 15,   // Any holding above mandate max_single_position_pct
}

// Latest facility snapshot helper (official per-snapshot columns).
function facilityLtvAt(cf, snapshotDate) {
  const ltv = cf[`ltv_pct_${snapshotDate}`]
  return typeof ltv === 'number' ? ltv : null
}

// ─── Basic Scoring for All Clients ────────────────────────────────────────────

function scoreClient(clientId, snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const client = store.clientById[clientId]
  if (!client) return null

  const factors = {}
  const factorNotes = {}
  let totalScore = 0
  const ref = new Date(snapshotDate)

  // 1. Liquidity urgency — confirmed cash needs by due_from proximity.
  const cashNeeds = store.cashNeedsByClient[clientId] || []
  const daysTo = (d) => Math.round((new Date(d) - ref) / (1000 * 60 * 60 * 24))
  const confirmed = cashNeeds.filter(cn => (cn.certainty || '').toLowerCase() === 'confirmed')
  const within120 = confirmed.filter(cn => { const d = daysTo(cn.due_from); return d >= 0 && d <= 120 })
  const within240 = confirmed.filter(cn => { const d = daysTo(cn.due_from); return d > 120 && d <= 240 })
  if (within120.length > 0) {
    factors.liquidityUrgency = WEIGHTS.liquidityUrgency; totalScore += WEIGHTS.liquidityUrgency
    factorNotes.liquidityUrgency = `${within120.length} confirmed cash need(s) within 120 days`
  } else if (within240.length > 0) {
    factors.liquidityModerate = WEIGHTS.liquidityModerate; totalScore += WEIGHTS.liquidityModerate
    factorNotes.liquidityModerate = `${within240.length} confirmed cash need(s) within 240 days`
  }

  // 2. Credit facility proximity to margin call.
  const facilities = store.creditFacilitiesByClient[clientId] || []
  let minHeadroom = null
  for (const cf of facilities) {
    const ltv = facilityLtvAt(cf, snapshotDate)
    const mc = cf.margin_call_ltv_pct
    if (typeof ltv === 'number' && typeof mc === 'number') {
      const hr = mc - ltv
      if (minHeadroom === null || hr < minHeadroom) minHeadroom = hr
    }
  }
  if (minHeadroom !== null && minHeadroom <= 2) {
    factors.creditCritical = WEIGHTS.creditCritical; totalScore += WEIGHTS.creditCritical
    factorNotes.creditCritical = `Credit facility within ${Math.round(minHeadroom * 100) / 100}ppts of margin call`
  } else if (minHeadroom !== null && minHeadroom <= 10) {
    factors.creditWarning = WEIGHTS.creditWarning; totalScore += WEIGHTS.creditWarning
    factorNotes.creditWarning = `Credit facility within ${Math.round(minHeadroom * 100) / 100}ppts of margin call`
  }

  // 3. Mandate checks — per-asset-class bands from mandates.csv.
  const portfolios = store.portfoliosByClient[clientId] || []
  const agg = getClientAggregatedPortfolio(clientId, snapshotDate)
  const allocByClass = Object.fromEntries(agg.allocation.map(a => [a.assetClass, a.weightPct]))
  let worstBreach = null // { assetClass, actual, max, ppts }
  for (const pf of portfolios) {
    const rows = store.mandateRowsByCode[pf.mandate_code] || []
    for (const r of rows) {
      const actual = allocByClass[r.asset_class] ?? 0
      if (typeof r.max_pct === 'number' && actual > r.max_pct) {
        const ppts = actual - r.max_pct
        if (!worstBreach || ppts > worstBreach.ppts) worstBreach = { assetClass: r.asset_class, actual, max: r.max_pct, ppts }
      }
    }
  }
  if (worstBreach) {
    if (worstBreach.ppts > 5) {
      factors.mandateBreach = WEIGHTS.mandateBreach; totalScore += WEIGHTS.mandateBreach
      factorNotes.mandateBreach = `${worstBreach.assetClass} ${Math.round(worstBreach.actual * 10) / 10}% vs mandate max ${worstBreach.max}% (breach +${Math.round(worstBreach.ppts * 10) / 10}ppts)`
    } else {
      factors.mandateWarning = WEIGHTS.mandateWarning; totalScore += WEIGHTS.mandateWarning
      factorNotes.mandateWarning = `${worstBreach.assetClass} ${Math.round(worstBreach.actual * 10) / 10}% above mandate max ${worstBreach.max}%`
    }
  }

  // 4. Single-position breach (any holding above mandate max_single_position_pct).
  let singleBreach = null
  for (const pf of portfolios) {
    const singleMax = (store.mandateRowsByCode[pf.mandate_code] || [])[0]?.max_single_position_pct
    if (typeof singleMax !== 'number') continue
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)
    for (const h of holdings) {
      if (typeof h.weight_pct === 'number' && h.weight_pct > singleMax) {
        if (!singleBreach || h.weight_pct > singleBreach.weightPct) singleBreach = { name: h.instrument_name, weightPct: h.weight_pct, max: singleMax }
      }
    }
  }
  if (singleBreach) {
    factors.singlePositionBreach = WEIGHTS.singlePositionBreach; totalScore += WEIGHTS.singlePositionBreach
    factorNotes.singlePositionBreach = `${singleBreach.name} ${Math.round(singleBreach.weightPct * 10) / 10}% vs single-position max ${singleBreach.max}%`
  }

  // 5. Concentration by sector (independent of asset-class mandate bands).
  const sectorConc = getClientSectorConcentration(clientId, snapshotDate)
  const topSector = sectorConc[0]
  if (topSector) {
    if (topSector.weightPct > 50 && !factors.concentrationHigh) {
      factors.concentrationHigh = WEIGHTS.concentrationHigh; totalScore += WEIGHTS.concentrationHigh
      factorNotes.concentrationHigh = `${topSector.sector} sector at ${topSector.weightPct}% of book`
    } else if (topSector.weightPct > 35 && !factors.concentrationMedium && !factors.concentrationHigh) {
      factors.concentrationMedium = WEIGHTS.concentrationMedium; totalScore += WEIGHTS.concentrationMedium
      factorNotes.concentrationMedium = `${topSector.sector} sector at ${topSector.weightPct}% of book`
    }
  }

  // 6. Scenario exposure — sectors hit by Severe/High authoritative events.
  const hasSevereEvents = store.raw.eventLog.some(e => e.authoritative === true && (e.severity === 'Severe' || e.severity === 'High'))
  let scenarioExposed = false
  for (const pf of portfolios) {
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)
    for (const h of holdings) {
      const s = `${h.sector || ''} ${h.sub_asset_class || ''} ${h.instrument_name || ''}`.toLowerCase()
      if (/shipping|logistics|energy|oil|petro|real estate|property|technology|semiconductor/.test(s)) { scenarioExposed = true; break }
    }
    if (scenarioExposed) break
  }
  if (hasSevereEvents && scenarioExposed) {
    factors.scenarioExposure = WEIGHTS.scenarioExposure; totalScore += WEIGHTS.scenarioExposure
    factorNotes.scenarioExposure = 'Portfolio exposed to sectors touched by Severe/High authoritative events'
  }

  return {
    clientId,
    clientName: client.client_name,
    baseCurrency: client.base_currency,
    riskProfile: client.risk_profile,
    snapshotDate,
    analysisDepth: 'basic',
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

// ─── Deep-client authoritative score ─────────────────────────────────────────

function scoreClientAuthoritative(clientId, snapshotDate = LATEST_SNAPSHOT) {
  const deepScorer = DEEP_CLIENT_SCORERS[clientId]
  if (!deepScorer) return scoreClient(clientId, snapshotDate)

  const store = loadAllData()
  const client = store.clientById[clientId]
  const raw = deepScorer(snapshotDate)
  const factors = raw.priorityFactors || {}

  const factorNotes = {}
  for (const key of Object.keys(factors)) factorNotes[key] = humaniseFactor(key)

  const whyThisClient = (raw.signals || [])
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .map(s => `[${(s.severity || '').toUpperCase()}] ${s.title}`)

  return {
    clientId,
    clientName: raw.clientName || client?.client_name,
    baseCurrency: client?.base_currency,
    riskProfile: client?.risk_profile,
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
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim()
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
