/**
 * intelligenceEngine.js
 *
 * Frontend contract — getClientIntelligence(clientId) — OFFICIAL schema.
 *
 * Returns:
 * {
 *   clientId, clientName, priority, priorityScore, priorityFactors,
 *   signals: [{ id, type, severity, title, summary, verifiedMetrics,
 *               relevanceFactors, evidence, uncertainty }],
 *   snapshotHistory, rmContext, relevantEvents, scenarios, aiBriefInput, detail
 * }
 *
 * Deep analysis: CL-0014, CL-0019, CL-0003. Basic analysis: all other clients.
 */

import { loadAllData } from './dataLoader.js'
import { getLauChiMingIntelligence } from './lauIntelligence.js'
import { getAbdullahIntelligence } from './abdullahIntelligence.js'
import { getMargartheIntelligence } from './margaretheIntelligence.js'
import { scoreClient } from './priorityEngine.js'
import { getRelevantEvents, buildEventContextForAI } from './eventGrounding.js'
import { getSnapshotHistory, getClientAggregatedPortfolio, LATEST_SNAPSHOT } from './snapshotEngine.js'

// ─── Main Entry Point ──────────────────────────────────────────────────────────

export function getClientIntelligence(clientId, snapshotDate = LATEST_SNAPSHOT) {
  switch (clientId) {
    case 'CL-0014': return formatLauIntelligence(snapshotDate)
    case 'CL-0019': return formatAbdullahIntelligence(snapshotDate)
    case 'CL-0003': return formatMargartheIntelligence(snapshotDate)
    default: return formatBasicIntelligence(clientId, snapshotDate)
  }
}

// ─── Lau Chi Ming ──────────────────────────────────────────────────────────────

function formatLauIntelligence(snapshotDate) {
  const raw = getLauChiMingIntelligence(snapshotDate)
  const eventContext = buildEventContextForAI('CL-0014', ['EVT-012', 'EVT-013'])

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
      lastContactDate: raw.rmNotes?.[raw.rmNotes.length - 1]?.date || null,
    },
    relevantEvents: eventContext.events,
    scenarios: raw.scenario ? [raw.scenario] : [],
    aiBriefInput: buildAIBriefInput('CL-0014', raw, eventContext),
    detail: {
      propertyConcentration: raw.propertyConcentration,
      creditFacilityStatus: raw.creditFacilityStatus,
      cashRequirement: raw.cashRequirement,
      aggregatePortfolio: raw.aggregatePortfolio,
      mandate: raw.mandate,
    },
  }
}

// ─── Abdullah Al-Mansoori ──────────────────────────────────────────────────────

function formatAbdullahIntelligence(snapshotDate) {
  const raw = getAbdullahIntelligence(snapshotDate)
  const eventContext = buildEventContextForAI('CL-0019', raw.hormuzScenario?.authoritativeEventIds || null)

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
      lastContactDate: raw.rmNotes?.[raw.rmNotes.length - 1]?.date || null,
    },
    relevantEvents: raw.relevantEvents,
    scenarios: raw.hormuzScenario ? [raw.hormuzScenario] : [],
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
  const eventContext = buildEventContextForAI('CL-0003', ['EVT-009', 'EVT-012'])

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
      lastContactDate: raw.rmNotes?.[raw.rmNotes.length - 1]?.date || null,
    },
    relevantEvents: raw.relevantEvents,
    scenarios: raw.scenario ? [raw.scenario] : [],
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
    clientName: client.client_name,
    priority: score.priority,
    priorityScore: score.priorityScore,
    priorityFactors: score.scoreComponents,
    signals,
    snapshotHistory,
    rmContext: {
      recentNotes: rmNotes.map(n => ({
        noteId: n.note_id,
        date: n.note_date,
        channel: n.channel,
        rmName: n.rm_name,
        body: n.note,
      })),
    },
    relevantEvents,
    scenarios: [],
    aiBriefInput: null,
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
 */
function buildAIBriefInput(clientId, raw, eventContext) {
  const store = loadAllData()
  const client = store.clientById[clientId]
  const scenario = raw.scenario || raw.hormuzScenario || null

  return {
    clientContext: {
      clientId,
      clientName: client?.client_name,
      baseCurrency: client?.base_currency,
      age: client?.age,
      wealthBand: client?.wealth_band,
      lifeStage: client?.life_stage,
      riskProfile: client?.risk_profile,
      objectives: client?.objectives,
      sourceOfWealth: client?.source_of_wealth,
      investmentHorizonYears: client?.investment_horizon_years,
      liquidityNeeds: client?.liquidity_needs,
      clientSince: client?.client_since,
    },
    verifiedMetrics: extractVerifiedMetrics(clientId, raw),
    signals: (raw.signals || []).map(s => ({
      id: s.id, type: s.type, severity: s.severity, title: s.title, summary: s.summary, verifiedMetrics: s.verifiedMetrics,
    })),
    evidence: (raw.signals || []).flatMap(s => s.evidence || []),
    rmNotes: (raw.rmNotes || []).map(n => ({
      noteId: n.noteId, date: n.date, channel: n.channel, rmName: n.rmName, body: n.body,
    })),
    authoritativeEvents: eventContext.events,
    authoritativeEventContextText: eventContext.contextText,
    scenario,
    uncertainties: collectUncertainties(raw),
  }
}

function extractVerifiedMetrics(clientId, raw) {
  if (clientId === 'CL-0014') {
    const cf = raw.creditFacilityStatus?.facilities?.[0]
    const need = raw.cashRequirement?.primaryCashNeed
    return {
      portfolioValueBase: raw.propertyConcentration?.totalPortfolioBase,
      baseCurrency: raw.propertyConcentration?.baseCurrency,
      propertyConcentrationPct: raw.propertyConcentration?.totalPropertyPct,
      facilityId: cf?.facilityId,
      facilityLtvPct: cf?.ltvCurrentPct,
      facilityMarginCallPct: cf?.marginCallLtvPct,
      facilityHeadroomPpts: cf?.headroomToMarginCallPpts,
      cashNeed: need?.amount,
      cashNeedCurrency: need?.currency,
      cashNeedDueFrom: need?.dueFrom,
      cashNeedDueTo: need?.dueTo,
    }
  }
  if (clientId === 'CL-0019') {
    const exp = raw.shippingEnergyExposure
    return {
      portfolioValueBase: exp?.totalPortfolioBase,
      baseCurrency: exp?.baseCurrency,
      shippingPct: exp?.shippingPct,
      energyPct: exp?.energyPct,
      shippingEnergyNotePct: exp?.notePct,
      combinedShippingEnergyPct: exp?.combinedShippingEnergyPct,
      objectiveAlignment: raw.objectiveAlignment?.alignmentStatus,
      hormuzStressImpactBase: raw.hormuzScenario?.calculatedStressResult?.totalStressImpactBase,
      hormuzStressImpactPct: raw.hormuzScenario?.calculatedStressResult?.portfolioStressImpactPct,
    }
  }
  if (clientId === 'CL-0003') {
    const eq = raw.equityAnalysis
    const tax = raw.cashCoverage?.find(cn => cn.needId === 'CN-004') || raw.cashCoverage?.[0]
    return {
      portfolioValueBase: eq?.totalBase,
      baseCurrency: eq?.baseCurrency,
      equityPct: eq?.equityPct,
      mandateEquityMax: eq?.mandateEquityMax,
      equityBreachPpts: eq?.equityBreachPpts,
      largestPositionName: eq?.largestPosition?.name,
      largestPositionWeightPct: eq?.largestPosition?.weightPct,
      singlePositionMaxPct: eq?.singlePositionMaxPct,
      inheritanceTaxAmount: tax?.amount,
      inheritanceTaxCurrency: tax?.currency,
      inheritanceTaxDueFrom: tax?.dueFrom,
      inheritanceTaxDueTo: tax?.dueTo,
      inheritanceTaxCoveredByCash: tax?.coverableFromCash,
    }
  }
  return {}
}

function collectUncertainties(raw) {
  const uncertainties = []
  for (const signal of raw.signals || []) {
    if (!signal.uncertainty) continue
    if (Array.isArray(signal.uncertainty)) uncertainties.push(...signal.uncertainty)
    else uncertainties.push(signal.uncertainty)
  }
  return [...new Set(uncertainties)]
}
