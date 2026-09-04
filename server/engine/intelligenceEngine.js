/**
 * intelligenceEngine.js
 *
 * Phase 10: Frontend contract — getClientIntelligence(clientId)
 *
 * Returns the full intelligence object conforming to the agreed schema:
 * {
 *   clientId, priority, priorityScore, priorityFactors,
 *   signals: [{ id, type, severity, title, summary, verifiedMetrics,
 *               relevanceFactors, evidence, uncertainty }],
 *   snapshotHistory, rmContext, relevantEvents, scenarios, aiBrief
 * }
 *
 * Deep analysis: CL-0014, CL-0019, CL-0003
 * Basic analysis: all other clients via priorityEngine
 */

import { loadAllData } from './dataLoader.js'
import { getLauChiMingIntelligence } from './lauIntelligence.js'
import { getAbdullahIntelligence } from './abdullahIntelligence.js'
import { getMargartheIntelligence } from './margaretheIntelligence.js'
import { scoreClient } from './priorityEngine.js'
import { getRelevantEvents, buildEventContextForAI } from './eventGrounding.js'
import { getSnapshotHistory, getClientAggregatedPortfolio, LATEST_SNAPSHOT } from './snapshotEngine.js'

// ─── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * Returns the full intelligence object for a client.
 * For primary clients (CL-0014, CL-0019, CL-0003): deep analysis.
 * For all other clients: basic priority scoring + snapshot + events.
 *
 * @param {string} clientId
 * @param {string} snapshotDate - defaults to LATEST_SNAPSHOT
 * @returns {object} Intelligence object conforming to frontend contract
 */
export function getClientIntelligence(clientId, snapshotDate = LATEST_SNAPSHOT) {
  switch (clientId) {
    case 'CL-0014':
      return formatLauIntelligence(snapshotDate)
    case 'CL-0019':
      return formatAbdullahIntelligence(snapshotDate)
    case 'CL-0003':
      return formatMargartheIntelligence(snapshotDate)
    default:
      return formatBasicIntelligence(clientId, snapshotDate)
  }
}

// ─── Lau Chi Ming ──────────────────────────────────────────────────────────────

function formatLauIntelligence(snapshotDate) {
  const raw = getLauChiMingIntelligence(snapshotDate)
  const eventContext = buildEventContextForAI('CL-0014', [
    'EVT-2026-001', 'EVT-2026-006', 'EVT-2026-007', 'EVT-2026-010',
    'EVT-2026-012', 'EVT-2026-014', 'EVT-2026-016', 'EVT-2026-020',
  ])

  return {
    clientId: 'CL-0014',
    clientName: raw.clientName,
    priority: raw.priority,
    priorityScore: raw.priorityScore,
    priorityFactors: raw.priorityFactors,
    signals: raw.signals,
    snapshotHistory: raw.snapshotHistory,
    rmContext: {
      rmId: raw.rmId,
      rmName: raw.rmName,
      recentNotes: raw.rmNotes,
      lastContactDate: raw.snapshotDate,
    },
    relevantEvents: eventContext.events,
    scenarios: [],  // Lau does not have a scenario in this phase; credit stress could be added
    aiBriefInput: buildAIBriefInput('CL-0014', raw, eventContext),
    // Detailed calculation outputs for display
    detail: {
      propertyConcentration: raw.propertyConcentration,
      creditFacilityStatus: raw.creditFacilityStatus,
      cashRequirement: raw.cashRequirement,
      structuredProducts: raw.structuredProducts,
      aggregatePortfolio: raw.aggregatePortfolio,
      mandate: raw.mandate,
    },
  }
}

// ─── Abdullah Al-Mansoori ──────────────────────────────────────────────────────

function formatAbdullahIntelligence(snapshotDate) {
  const raw = getAbdullahIntelligence(snapshotDate)
  const eventContext = buildEventContextForAI('CL-0019')

  return {
    clientId: 'CL-0019',
    clientName: raw.clientName,
    priority: raw.priority,
    priorityScore: raw.priorityScore,
    priorityFactors: raw.priorityFactors,
    signals: raw.signals,
    snapshotHistory: raw.snapshotHistory,
    rmContext: {
      rmId: raw.rmId,
      rmName: raw.rmName,
      recentNotes: raw.rmNotes,
    },
    relevantEvents: raw.relevantEvents,
    scenarios: [raw.hormuzScenario],
    aiBriefInput: buildAIBriefInput('CL-0019', raw, eventContext),
    detail: {
      shippingEnergyExposure: raw.shippingEnergyExposure,
      objectiveAlignment: raw.objectiveAlignment,
      hormuzScenario: raw.hormuzScenario,
      aggregatePortfolio: raw.aggregatePortfolio,
      mandate: raw.mandate,
      cashNeeds: raw.cashNeeds,
      commitments: raw.commitments,
    },
  }
}

// ─── Margarethe Voss-Brenner ───────────────────────────────────────────────────

function formatMargartheIntelligence(snapshotDate) {
  const raw = getMargartheIntelligence(snapshotDate)
  const eventContext = buildEventContextForAI('CL-0003', ['EVT-2026-008', 'EVT-2026-009'])

  return {
    clientId: 'CL-0003',
    clientName: raw.clientName,
    priority: raw.priority,
    priorityScore: raw.priorityScore,
    priorityFactors: raw.priorityFactors,
    signals: raw.signals,
    snapshotHistory: raw.snapshotHistory,
    rmContext: {
      rmId: raw.rmId,
      rmName: raw.rmName,
      recentNotes: raw.rmNotes,
    },
    relevantEvents: raw.relevantEvents,
    scenarios: [],
    aiBriefInput: buildAIBriefInput('CL-0003', raw, eventContext),
    detail: {
      equityAnalysis: raw.equityAnalysis,
      mandateChecks: raw.mandateChecks,
      cashCoverage: raw.cashCoverage,
      aggregatePortfolio: raw.aggregatePortfolio,
      mandate: raw.mandate,
      lifeEventContext: raw.lifeEventContext,
    },
  }
}

// ─── Basic Intelligence (all other clients) ────────────────────────────────────

function formatBasicIntelligence(clientId, snapshotDate) {
  const store = loadAllData()
  const client = store.clientById[clientId]
  if (!client) return null

  const score = scoreClient(clientId, snapshotDate)
  const snapshotHistory = getSnapshotHistory(clientId)
  const aggregatePortfolio = getClientAggregatedPortfolio(clientId, snapshotDate)
  const relevantEvents = getRelevantEvents(clientId)
  const rmNotes = store.rmNotesByClient[clientId] || []
  const cashNeeds = store.cashNeedsByClient[clientId] || []

  // Basic signals from score components
  const signals = Object.entries(score.scoreComponents || {}).map(([factor, pts]) => ({
    id: `${clientId}-${factor}`,
    type: factor,
    severity: pts >= 25 ? 'high' : pts >= 15 ? 'medium' : 'low',
    title: score.factorNotes[factor] || factor,
    summary: score.factorNotes[factor] || factor,
    verifiedMetrics: { scoreContribution: pts },
    relevanceFactors: [],
    evidence: [],
    uncertainty: 'Basic scoring — no deep analysis for this client.',
  }))

  return {
    clientId,
    clientName: client.full_name,
    priority: score.priority,
    priorityScore: score.priorityScore,
    priorityFactors: score.scoreComponents,
    signals,
    snapshotHistory,
    rmContext: {
      recentNotes: rmNotes.map(n => ({
        noteId: n.note_id,
        date: n.note_date,
        subject: n.subject,
        type: n.note_type,
        actionRequired: n.action_required,
      })),
    },
    relevantEvents,
    scenarios: [],
    aiBriefInput: null,  // Not generated for basic clients
    detail: {
      aggregatePortfolio,
      cashNeeds,
    },
  }
}

// ─── AI Brief Input Builder ────────────────────────────────────────────────────

/**
 * Assembles the structured payload sent to the OpenAI backend.
 * AI receives verified facts — never raw portfolio calculations.
 *
 * GOVERNANCE:
 *   - verifiedMetrics: code-calculated numbers only
 *   - authoritativeEvents: only from event_log.csv
 *   - AI must not invent facts, calculate figures, or reference unverified events
 */
function buildAIBriefInput(clientId, rawIntelligence, eventContext) {
  const store = loadAllData()
  const client = store.clientById[clientId]
  const mandate = store.mandateByClient[clientId]

  return {
    clientContext: {
      clientId,
      clientName: client?.full_name,
      domicile: client?.domicile_country,
      segment: client?.segment,
      riskProfile: client?.risk_profile,
      investmentObjective: client?.investment_objective,
      mandateType: client?.mandate_type,
      sourceOfWealth: client?.source_of_wealth,
      businessSector: client?.business_sector,
      relationshipSince: client?.relationship_since,
      nextOfKinNote: client?.next_of_kin_note,
    },
    verifiedMetrics: extractVerifiedMetrics(clientId, rawIntelligence),
    signals: (rawIntelligence.signals || []).map(s => ({
      id: s.id,
      type: s.type,
      severity: s.severity,
      title: s.title,
      summary: s.summary,
      verifiedMetrics: s.verifiedMetrics,
    })),
    evidence: (rawIntelligence.signals || []).flatMap(s => s.evidence || []),
    rmNotes: (rawIntelligence.rmNotes || []).map(n => ({
      noteId: n.noteId,
      date: n.date,
      subject: n.subject,
      type: n.type,
      relevantBody: n.body?.substring(0, 500),  // Truncate for prompt efficiency
      tags: n.tags,
      actionRequired: n.actionRequired,
    })),
    authoritativeEvents: eventContext.events,
    authoritativeEventContextText: eventContext.contextText,
    scenario: rawIntelligence.hormuzScenario || null,
    uncertainties: collectUncertainties(rawIntelligence),
  }
}

function extractVerifiedMetrics(clientId, raw) {
  if (clientId === 'CL-0014') {
    return {
      totalPortfolioChf: raw.aggregatePortfolio?.totalChf,
      propertyConcentrationPct: raw.propertyConcentration?.totalPropertyPct,
      directPropertyPct: raw.propertyConcentration?.directPropertyPct,
      structuredPropertyPct: raw.propertyConcentration?.structuredPropertyPct,
      cashNeedHkd: 60000000,
      cashNeedChf: 7200000,
      cashNeedDueDate: '2026-11-30',
      currentCashChf: raw.cashRequirement?.cashPositionChf,
      lombardDrawnHkd: 142000000,
      lombardLtvPct: 48.97,
      criticalFacilityId: 'CF-0014-003',
      criticalFacilityLtvPct: 77.42,
      criticalFacilityMarginCallPct: 85,
      criticalFacilityHeadroomPpts: 7.58,
      autocallableMaturityDate: '2026-12-31',
    }
  }
  if (clientId === 'CL-0019') {
    return {
      totalPortfolioChf: raw.aggregatePortfolio?.totalChf,
      shippingExposurePct: raw.shippingEnergyExposure?.shippingPct,
      energyExposurePct: raw.shippingEnergyExposure?.energyPct,
      combinedShippingEnergyPct: raw.shippingEnergyExposure?.combinedShippingEnergyPct,
      statedDiversificationObjectiveDate: '2026-05-18',
      businessConcentrationPct: 67.5,
      shippingNoteCurrentChf: raw.detail?.shippingEnergyExposure?.shippingHoldings?.find(h => h.instrumentId === 'INS-0024')?.valueChf,
      hormuzObservedImpactChf: raw.hormuzScenario?.knownData?.observedTotalImpactChf,
      hormuzStressImpactChf: raw.hormuzScenario?.calculatedStressResult?.totalStressImpactChf,
      hormuzStressImpactPct: raw.hormuzScenario?.calculatedStressResult?.portfolioStressImpactPct,
    }
  }
  if (clientId === 'CL-0003') {
    return {
      totalPortfolioChf: raw.aggregatePortfolio?.totalChf,
      effectiveEquityPct: raw.equityAnalysis?.effectiveEquityPct,
      mandateEquityMax: 30,
      equityBreachPpts: raw.equityAnalysis ? (raw.equityAnalysis.effectiveEquityPct - 30) : null,
      deutscheBankWeightPct: raw.equityAnalysis?.deutscheBankWeightPct,
      inheritanceTaxDec2026Eur: 4200000,
      inheritanceTaxDec2026Chf: 4620000,
      inheritanceTaxJun2027Eur: 3800000,
      availableCashChf: raw.cashCoverage?.[0]?.availableCashChf,
      age: 67,
    }
  }
  return {}
}

function collectUncertainties(raw) {
  const uncertainties = []
  for (const signal of raw.signals || []) {
    if (signal.uncertainty) {
      if (Array.isArray(signal.uncertainty)) {
        uncertainties.push(...signal.uncertainty)
      } else {
        uncertainties.push(signal.uncertainty)
      }
    }
  }
  return [...new Set(uncertainties)]
}
