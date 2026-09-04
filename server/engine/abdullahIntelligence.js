/**
 * abdullahIntelligence.js
 *
 * Abdullah Al-Mansoori (CL-0019) intelligence engine — OFFICIAL schema.
 *
 * Client: USD base, "Balanced Growth" risk profile, mandate BALG, portfolio PF-0023.
 * Story (all deterministic from official data @2026-08-26):
 *   - Stated objective is to build wealth OUTSIDE the Gulf region and OUTSIDE
 *     shipping (clients.csv objectives; RM notes N-025/N-026). Yet the portfolio
 *     holds direct shipping equity (Pacific Orient Shipping, Asia Pacific Shipping
 *     & Logistics Fund), energy equity (Global Energy Majors), and a Fixed Coupon
 *     Note whose worst-of basket is Pacific Orient Shipping / Global Energy Majors
 *     ADR / Bara Nusantara Energy — i.e. the note re-expresses the same shipping +
 *     energy bet with no capital protection.
 *   - The Strait of Hormuz event chain in event_log.csv (EVT-004/006/007/008/010/016)
 *     transmits directly to exactly these holdings AND to the client's operating
 *     shipping business at the same time.
 *   - Confirmed-ish USD 5m Singapore family office seed capital (CN-017, "Likely", 2027).
 *
 * GOVERNANCE:
 *   - event_log.csv is the ONLY authority for 2026 events — no invented events.
 *   - Scenario labels: KNOWN DATA | ASSUMPTIONS | CALCULATED STRESS RESULT | UNCERTAINTY.
 *   - Scenarios are stress tests, NOT forecasts. AI never calculates.
 */

import { loadAllData } from './dataLoader.js'
import {
  getClientAggregatedPortfolio,
  getHoldingsAtSnapshot,
  getSnapshotHistory,
  LATEST_SNAPSHOT,
} from './snapshotEngine.js'
import { getRelevantEvents } from './eventGrounding.js'

const CLIENT_ID = 'CL-0019'
const PORTFOLIO_ID = 'PF-0023'

// Hormuz / energy-supply event chain (synthesised ids, all authoritative).
const HORMUZ_EVENT_IDS = ['EVT-004', 'EVT-006', 'EVT-007', 'EVT-008', 'EVT-010', 'EVT-016']

const SHIPPING_RE = /shipping|marine|logistics|charter|tanker|freight/i
const ENERGY_RE = /energy|oil|petro|lng|crude/i

function classify(h) {
  const s = `${h.sector || ''} ${h.sub_asset_class || ''} ${h.instrument_name || ''}`
  return { shipping: SHIPPING_RE.test(s), energy: ENERGY_RE.test(s) }
}

// A structured note "re-expresses" shipping/energy if its underlying_reference
// (instruments.csv) mentions shipping/energy names.
function noteTouchesShippingEnergy(instrument) {
  const ref = `${instrument?.underlying_reference || ''}`
  return SHIPPING_RE.test(ref) || ENERGY_RE.test(ref)
}

// ─── Shipping & Energy Exposure ─────────────────────────────────────────────────

export function calculateShippingEnergyExposure(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const holdings = getHoldingsAtSnapshot(PORTFOLIO_ID, snapshotDate)

  let totalBase = 0
  let shippingBase = 0
  let energyBase = 0
  let noteBase = 0
  const shippingHoldings = []
  const energyHoldings = []
  const noteHoldings = []

  for (const h of holdings) {
    const v = h.market_value_base
    if (typeof v !== 'number') continue
    totalBase += v

    const inst = store.instrumentById[h.instrument_id]
    const { shipping, energy } = classify(h)
    const isNote = (h.asset_class || '') === 'Structured Products'

    if (shipping) { shippingBase += v; shippingHoldings.push(holdingRow(h)) }
    if (energy && !shipping) { energyBase += v; energyHoldings.push(holdingRow(h)) }
    if (isNote && noteTouchesShippingEnergy(inst)) {
      noteBase += v
      noteHoldings.push({ ...holdingRow(h), underlyingReference: inst?.underlying_reference || null, capitalProtected: false })
    }
  }

  const pct = (n) => (totalBase > 0 ? Math.round((n / totalBase) * 10000) / 100 : 0)
  // Direct shipping + energy + note that re-expresses shipping/energy.
  const combinedBase = shippingBase + energyBase + noteBase

  const evidence = [
    {
      claim: 'Direct shipping exposure in the portfolio',
      value: `${pct(shippingBase)}% (USD ${Math.round(shippingBase).toLocaleString()})`,
      source: 'holdings.csv',
      recordId: PORTFOLIO_ID,
      snapshot: snapshotDate,
      calculation: 'Sum of market_value_base where sector/name matches shipping/logistics keywords / total',
      supportingFields: ['market_value_base', 'sector', 'sub_asset_class', 'instrument_name'],
    },
    {
      claim: 'Structured note re-expressing shipping/energy (no capital protection)',
      value: `${pct(noteBase)}% — Fixed Coupon Note ref. Basket C, worst-of Pacific Orient Shipping / Global Energy Majors / Bara Nusantara Energy`,
      source: 'holdings.csv + instruments.csv (underlying_reference)',
      recordId: PORTFOLIO_ID,
      snapshot: snapshotDate,
      calculation: 'Structured Products holding whose instruments.underlying_reference names shipping/energy underlyings',
      supportingFields: ['market_value_base', 'asset_class', 'underlying_reference'],
    },
  ]

  return {
    clientId: CLIENT_ID,
    portfolioId: PORTFOLIO_ID,
    snapshotDate,
    baseCurrency: holdings[0]?.portfolio_ccy || 'USD',
    totalPortfolioBase: Math.round(totalBase),
    shippingBase: Math.round(shippingBase),
    shippingPct: pct(shippingBase),
    energyBase: Math.round(energyBase),
    energyPct: pct(energyBase),
    noteBase: Math.round(noteBase),
    notePct: pct(noteBase),
    combinedShippingEnergyBase: Math.round(combinedBase),
    combinedShippingEnergyPct: pct(combinedBase),
    shippingHoldings,
    energyHoldings,
    noteHoldings,
    evidence,
  }
}

function holdingRow(h) {
  return {
    instrumentId: h.instrument_id,
    name: h.instrument_name,
    assetClass: h.asset_class,
    subClass: h.sub_asset_class,
    sector: h.sector,
    valueBase: Math.round(h.market_value_base || 0),
    weightPct: h.weight_pct,
  }
}

// ─── Objective Alignment ────────────────────────────────────────────────────────

export function analyseObjectiveAlignment(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const client = store.clientById[CLIENT_ID]
  const rmNotes = store.rmNotesByClient[CLIENT_ID] || []
  const exposure = calculateShippingEnergyExposure(snapshotDate)

  // The RM note where the client states the Asia portfolio should be uncorrelated
  // with the Gulf shipping business.
  const objectiveNote = rmNotes.find(n => /uncorrelated|diversif|gulf|shipping/i.test(n.note || '')) || rmNotes[0]

  const isMisaligned = exposure.combinedShippingEnergyPct > 15
  const objectiveEvidence = {
    claim: 'Stated objective (diversify away from Gulf/shipping) vs actual shipping/energy exposure',
    value: `Objective: "${client?.objectives || ''}". Actual combined shipping + energy + note exposure: ${exposure.combinedShippingEnergyPct}%`,
    source: 'clients.csv (objectives) + rm_notes.json + holdings.csv',
    recordId: objectiveNote?.note_id || CLIENT_ID,
    snapshot: snapshotDate,
    calculation: `shipping ${exposure.shippingPct}% + energy ${exposure.energyPct}% + shipping/energy note ${exposure.notePct}% = ${exposure.combinedShippingEnergyPct}%`,
    supportingFields: ['objectives', 'note', 'market_value_base', 'underlying_reference'],
  }

  return {
    clientId: CLIENT_ID,
    snapshotDate,
    statedObjective: client?.objectives || 'Build wealth outside the Gulf region and outside shipping',
    statedObjectiveSource: 'clients.csv objectives + rm_notes.json',
    objectiveNoteId: objectiveNote?.note_id || null,
    objectiveNoteDate: objectiveNote?.note_date || null,
    portfolioShippingEnergyPct: exposure.combinedShippingEnergyPct,
    alignmentStatus: isMisaligned ? 'MISALIGNED' : 'ALIGNED',
    keyConflict: isMisaligned ? {
      description: 'The portfolio holds direct shipping/energy AND a structured note whose worst-of basket is shipping/energy — the same bet the client wants to reduce, and the same conditions that drive his operating business.',
      problematicHoldings: [
        ...exposure.shippingHoldings.map(h => h.name),
        ...exposure.energyHoldings.map(h => h.name),
        ...exposure.noteHoldings.map(h => h.name),
      ],
      mostProblematic: exposure.noteHoldings[0]?.name || null,
    } : null,
    objectiveEvidence,
    exposure,
  }
}

// ─── Hormuz Re-escalation Stress Test ────────────────────────────────────────────

export function buildHormuzScenario(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const events = HORMUZ_EVENT_IDS
    .map(id => store.raw.eventLog.find(e => e.event_id === id))
    .filter(Boolean)

  const exposure = calculateShippingEnergyExposure(snapshotDate)

  // ── ASSUMPTIONS (stated, not authoritative) — stress magnitudes for a full
  //    Hormuz re-escalation, informed by the observed 2026 event severities. ──
  const ASSUMPTION_SHIPPING_STRESS_PCT = -18
  const ASSUMPTION_ENERGY_STRESS_PCT = -12
  const ASSUMPTION_NOTE_STRESS_PCT = -22 // worst-of note, no capital protection → most exposed

  const shippingImpact = Math.round(exposure.shippingBase * (ASSUMPTION_SHIPPING_STRESS_PCT / 100))
  const energyImpact = Math.round(exposure.energyBase * (ASSUMPTION_ENERGY_STRESS_PCT / 100))
  const noteImpact = Math.round(exposure.noteBase * (ASSUMPTION_NOTE_STRESS_PCT / 100))
  const totalImpact = shippingImpact + energyImpact + noteImpact
  const totalBase = exposure.totalPortfolioBase
  const impactPct = totalBase > 0 ? Math.round((Math.abs(totalImpact) / totalBase) * 10000) / 100 : null

  return {
    clientId: CLIENT_ID,
    scenarioName: 'Strait of Hormuz Re-escalation Stress Test',
    scenarioDescription:
      'Deterministic stress test: how the shipping, energy and worst-of note holdings respond to a re-escalation of the Strait of Hormuz disruption recorded in event_log.csv. NOT a forecast.',
    authoritativeEventIds: events.map(e => e.event_id),

    knownData: {
      _label: 'KNOWN DATA — authoritative events from event_log.csv + current holdings from holdings.csv',
      events: events.map(e => ({ eventId: e.event_id, date: e.event_date, type: e.event_type, region: e.region, severity: e.severity, transmission: e.primary_transmission, description: e.description })),
      shippingExposureBase: exposure.shippingBase,
      shippingExposurePct: exposure.shippingPct,
      energyExposureBase: exposure.energyBase,
      energyExposurePct: exposure.energyPct,
      noteExposureBase: exposure.noteBase,
      noteExposurePct: exposure.notePct,
      combinedShippingEnergyPct: exposure.combinedShippingEnergyPct,
      portfolioValueBase: totalBase,
      baseCurrency: exposure.baseCurrency,
    },

    assumptions: {
      _label: 'ASSUMPTIONS — stated, not authoritative; used for this stress test only',
      shippingStressPct: ASSUMPTION_SHIPPING_STRESS_PCT,
      energyStressPct: ASSUMPTION_ENERGY_STRESS_PCT,
      noteStressPct: ASSUMPTION_NOTE_STRESS_PCT,
      rationale:
        'Stress magnitudes chosen to represent a severe re-escalation, informed by the Severe-rated Hormuz events in event_log.csv. The worst-of note takes the largest hit because it has no capital protection and its underlyings are exactly the stressed sectors.',
    },

    calculatedStressResult: {
      _label: 'CALCULATED STRESS RESULT — arithmetic on current holdings + stated assumptions',
      shippingImpactBase: shippingImpact,
      energyImpactBase: energyImpact,
      noteImpactBase: noteImpact,
      totalStressImpactBase: totalImpact,
      portfolioStressImpactPct: impactPct != null ? -impactPct : null,
      currentPortfolioValueBase: totalBase,
      portfolioValueAfterStressBase: totalBase + totalImpact,
      baseCurrency: exposure.baseCurrency,
    },

    affectedExposures: [
      { label: 'Direct shipping', value: `${exposure.shippingPct}% (USD ${exposure.shippingBase.toLocaleString()})` },
      { label: 'Energy', value: `${exposure.energyPct}% (USD ${exposure.energyBase.toLocaleString()})` },
      { label: 'Shipping/energy note (no protection)', value: `${exposure.notePct}% (USD ${exposure.noteBase.toLocaleString()})` },
    ],

    portfolioImplications: [
      `A Hormuz re-escalation would concentrate losses in exactly the sectors the client wants to reduce: an estimated USD ${Math.abs(totalImpact).toLocaleString()} (${impactPct}% of the portfolio) under the stated assumptions.`,
      'The worst-of Fixed Coupon Note has no capital protection, so a shipping/energy drawdown is amplified rather than buffered.',
    ],

    objectiveImplications: [
      'The client\u2019s stated objective is to build wealth outside the Gulf and outside shipping. A regional re-escalation hits the portfolio and his operating shipping business simultaneously — the opposite of the diversification he asked for (RM note N-025).',
    ],

    uncertainty: {
      items: [
        'The stress percentages are illustrative assumptions, not forecasts.',
        'The worst-of note mark is issuer-provided and not independently verified.',
        'Correlation between shipping, energy and the note may be higher in a severe disruption than assumed.',
        'The impact on the client\u2019s operating business is not modelled here (portfolio only).',
        'De-escalation timing is unknown and materially affects total impact.',
      ],
    },

    rmConsiderations: [
      'Review the combined shipping/energy/note exposure against the stated diversification objective.',
      'Discuss how a re-escalation would affect the portfolio and the operating business at the same time.',
      'Model the reciprocal case the client asked about (RM note N-026): what a Strait reopening/normalisation would mean.',
    ],

    evidence: [
      ...exposure.evidence,
      {
        label: 'Authoritative Hormuz event chain',
        value: events.map(e => `${e.event_id} ${e.event_date} (${e.severity})`).join('; '),
        source: 'event_log.csv',
        snapshot: snapshotDate,
        record: events.map(e => e.event_id).join(', '),
      },
    ],
  }
}

// ─── Main Intelligence Function ────────────────────────────────────────────────

export function getAbdullahIntelligence(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const client = store.clientById[CLIENT_ID]
  const pf = store.portfolioById[PORTFOLIO_ID]
  const mandateRows = store.mandateRowsByCode[pf?.mandate_code] || []

  const exposure = calculateShippingEnergyExposure(snapshotDate)
  const objectiveAlignment = analyseObjectiveAlignment(snapshotDate)
  const hormuzScenario = buildHormuzScenario(snapshotDate)
  const snapshotHistory = getSnapshotHistory(CLIENT_ID)
  const aggregatePortfolio = getClientAggregatedPortfolio(CLIENT_ID, snapshotDate)
  const rmNotes = store.rmNotesByClient[CLIENT_ID] || []
  const cashNeeds = store.cashNeedsByClient[CLIENT_ID] || []
  const commitments = store.commitmentsByClient[CLIENT_ID] || []

  const relevantEvents = getRelevantEvents(CLIENT_ID, ['Middle East', 'Global'], ['Oil', 'energy', 'shipping', 'supply', 'Hormuz'])

  const signals = []

  // Signal 1: objective misalignment
  if (objectiveAlignment.alignmentStatus === 'MISALIGNED') {
    signals.push({
      id: 'ABD-SIG-001',
      type: 'objective_alignment',
      severity: 'high',
      title: 'Portfolio conflicts with the stated diversification objective',
      summary: `The client wants wealth built outside the Gulf and outside shipping, yet ${exposure.combinedShippingEnergyPct}% of the portfolio is shipping, energy, or a worst-of note on those same sectors.`,
      verifiedMetrics: {
        portfolioShippingPct: exposure.shippingPct,
        portfolioEnergyPct: exposure.energyPct,
        shippingEnergyNotePct: exposure.notePct,
        combinedExposurePct: exposure.combinedShippingEnergyPct,
        problematicInstruments: objectiveAlignment.keyConflict?.problematicHoldings || [],
      },
      relevanceFactors: [
        'Objective is explicit in clients.csv and reinforced in RM note N-025',
        'The Fixed Coupon Note\u2019s worst-of basket is Pacific Orient Shipping / Global Energy Majors / Bara Nusantara Energy',
        'The same conditions drive the client\u2019s operating shipping business',
      ],
      evidence: [objectiveAlignment.objectiveEvidence],
      uncertainty: 'Broad index funds may carry incidental shipping/energy exposure not captured in this classification.',
    })
  }

  // Signal 2: worst-of note correlation / no capital protection
  const note = exposure.noteHoldings[0]
  if (note) {
    signals.push({
      id: 'ABD-SIG-002',
      type: 'structured_product',
      severity: 'high',
      title: 'Yield-enhancement note has no capital protection and re-expresses the concentration',
      summary: `${note.name} is ${note.weightPct}% of the portfolio. Its worst-of basket (${note.underlyingReference}) is principal-at-risk and directly correlated with the client\u2019s shipping/energy concentration.`,
      verifiedMetrics: {
        instrumentId: note.instrumentId,
        weightPct: note.weightPct,
        valueBase: note.valueBase,
        underlyingReference: note.underlyingReference,
        capitalProtected: false,
      },
      relevanceFactors: [
        'Worst-of structure means the note tracks the weakest underlying',
        'Underlyings overlap directly with the client\u2019s direct holdings and business',
        'Subscribed knowingly on a charter-rate view (RM note N-025)',
      ],
      evidence: [{
        claim: 'Fixed Coupon Note ref. Basket C exposure and underlying',
        value: `${note.weightPct}% | USD ${note.valueBase.toLocaleString()} | worst-of: ${note.underlyingReference}`,
        source: 'holdings.csv + instruments.csv',
        recordId: note.instrumentId,
        snapshot: snapshotDate,
        calculation: 'market_value_base + weight_pct from holdings.csv; underlying_reference from instruments.csv',
        supportingFields: ['market_value_base', 'weight_pct', 'underlying_reference'],
      }],
      uncertainty: 'Structured note mark is issuer-provided; not independently verified.',
    })
  }

  // Signal 3: Hormuz scenario
  signals.push({
    id: 'ABD-SIG-003',
    type: 'scenario',
    severity: 'medium',
    title: 'Hormuz re-escalation stress test — potential portfolio impact calculated',
    summary: `Using the authoritative Hormuz event chain and current holdings, a re-escalation stress test estimates a USD ${Math.abs(hormuzScenario.calculatedStressResult.totalStressImpactBase).toLocaleString()} impact (${Math.abs(hormuzScenario.calculatedStressResult.portfolioStressImpactPct)}% of portfolio). THIS IS A STRESS TEST, NOT A FORECAST.`,
    verifiedMetrics: {
      stressImpactBase: hormuzScenario.calculatedStressResult.totalStressImpactBase,
      stressImpactPct: hormuzScenario.calculatedStressResult.portfolioStressImpactPct,
      authoritativeEventIds: hormuzScenario.authoritativeEventIds,
      isScenario: true,
      isForecast: false,
    },
    relevanceFactors: [
      'Client has direct operating exposure to shipping through his own business',
      'Portfolio shipping/energy exposure compounds the operational risk',
    ],
    evidence: [{
      claim: 'Hormuz stress test inputs',
      value: `Events ${hormuzScenario.authoritativeEventIds.join(', ')}; portfolio USD ${hormuzScenario.calculatedStressResult.currentPortfolioValueBase.toLocaleString()}`,
      source: 'event_log.csv + holdings.csv',
      recordId: hormuzScenario.authoritativeEventIds.join(', '),
      snapshot: snapshotDate,
      calculation: 'Stress percentages applied to current shipping/energy/note market_value_base',
      supportingFields: ['market_value_base', 'severity', 'primary_transmission'],
    }],
    uncertainty: hormuzScenario.uncertainty.items,
  })

  const priorityFactors = {
    objectiveMisalignment: objectiveAlignment.alignmentStatus === 'MISALIGNED' ? 25 : 5,
    structuredProductRisk: note ? 20 : 0,
    scenarioExposure: 15,
    concentrationSeverity: exposure.combinedShippingEnergyPct > 35 ? 15 : 10,
  }
  const priorityScore = Object.values(priorityFactors).reduce((s, v) => s + v, 0)

  return {
    clientId: CLIENT_ID,
    clientName: client?.client_name || 'Abdullah Al-Mansoori',
    rmId: store.rm.rm_id,
    rmName: store.rm.rm_name,
    snapshotDate,
    priority: priorityScore >= 70 ? 'high' : priorityScore >= 50 ? 'medium' : 'low',
    priorityScore,
    priorityFactors,
    hormuzScenario,
    scenario: hormuzScenario,
    mandate: {
      mandateCode: pf?.mandate_code,
      mandateName: pf?.mandate_name,
      baseCurrency: pf?.base_currency,
      equityBand: mandateBand(mandateRows, 'Equity'),
      singlePositionMaxPct: mandateRows[0]?.max_single_position_pct ?? null,
    },
    aggregatePortfolio,
    shippingEnergyExposure: exposure,
    objectiveAlignment,
    signals: sortBySeverity(signals),
    snapshotHistory,
    relevantEvents,
    cashNeeds,
    commitments,
    rmNotes: mapRmNotes(rmNotes),
  }
}

// ─── shared helpers ─────────────────────────────────────────────────────────────

function mandateBand(rows, assetClass) {
  const r = rows.find(x => x.asset_class === assetClass)
  return r ? `${r.min_pct}-${r.max_pct}% (target ${r.target_pct}%)` : null
}
function sortBySeverity(signals) {
  const sev = { high: 3, medium: 2, low: 1 }
  return signals.slice().sort((a, b) => (sev[b.severity] || 0) - (sev[a.severity] || 0))
}
function mapRmNotes(notes) {
  return (notes || []).map(n => ({
    noteId: n.note_id,
    date: n.note_date,
    channel: n.channel,
    rmName: n.rm_name,
    body: n.note,
  }))
}
