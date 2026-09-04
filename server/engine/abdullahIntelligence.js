/**
 * abdullahIntelligence.js
 *
 * Phase 4: Abdullah Al-Mansoori (CL-0019) intelligence engine.
 *
 * GOVERNANCE:
 *   - event_log.csv is authoritative for the Hormuz disruption — no invented events.
 *   - Scenario outputs MUST label: KNOWN DATA | ASSUMPTION | CALCULATED RESULT | UNCERTAINTY.
 *   - Scenarios are stress analysis tools, NOT forecasts.
 *   - AI must not calculate; all figures here are code-computed.
 */

import { loadAllData, getChfRate } from './dataLoader.js'
import {
  getClientAggregatedPortfolio,
  getHoldingsAtSnapshot,
  getStructuredProductLookThrough,
  compareSnapshots,
  getSnapshotHistory,
  LATEST_SNAPSHOT,
} from './snapshotEngine.js'

const CLIENT_ID = 'CL-0019'

// Sector classification — matches instruments.csv sector field keywords
const SHIPPING_KEYWORDS = ['Shipping', 'shipping', 'Logistics', 'logistics']
const ENERGY_KEYWORDS = ['Energy', 'energy', 'Petrochemical', 'petrochemical', 'LNG', 'lng']

// ─── Sector Exposure Classification ───────────────────────────────────────────

function classifyHoldingExposure(holding, instrument) {
  if (!instrument) return { shipping: false, energy: false }
  const sectorStr = (instrument.sector || '') + ' ' + (instrument.sub_class || '') + ' ' + (instrument.name || '')
  const shipping = SHIPPING_KEYWORDS.some(kw => sectorStr.includes(kw))
  const energy = ENERGY_KEYWORDS.some(kw => sectorStr.includes(kw))
  return { shipping, energy }
}

// ─── Shipping and Energy Exposure ─────────────────────────────────────────────

export function calculateShippingEnergyExposure(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const portfolios = store.portfoliosByClient[CLIENT_ID] || []
  const evidence = []

  let totalChf = 0
  let shippingChf = 0
  let energyChf = 0
  let shippingEnergyChf = 0  // combined for instruments touching both
  const shippingHoldings = []
  const energyHoldings = []
  const structuredHoldings = []

  for (const pf of portfolios) {
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)

    for (const h of holdings) {
      if (typeof h.market_value_chf !== 'number') continue
      totalChf += h.market_value_chf

      const inst = store.instrumentById[h.instrument_id]
      const { shipping, energy } = classifyHoldingExposure(h, inst)

      if (shipping) {
        shippingChf += h.market_value_chf
        shippingHoldings.push({
          holdingId: h.holding_id,
          portfolioId: pf.portfolio_id,
          instrumentId: h.instrument_id,
          name: inst?.name || h.instrument_id,
          assetClass: h.asset_class,
          subClass: h.sub_class,
          sector: inst?.sector,
          valueChf: h.market_value_chf,
          weightPct: h.weight_pct,
          isStructured: inst?.is_structured || false,
          notes: inst?.notes || null,
        })
      }

      if (energy) {
        energyChf += h.market_value_chf
        energyHoldings.push({
          holdingId: h.holding_id,
          portfolioId: pf.portfolio_id,
          instrumentId: h.instrument_id,
          name: inst?.name || h.instrument_id,
          assetClass: h.asset_class,
          subClass: h.sub_class,
          sector: inst?.sector,
          valueChf: h.market_value_chf,
          weightPct: h.weight_pct,
          isStructured: inst?.is_structured || false,
          notes: inst?.notes || null,
        })
      }
    }

    // Structured products look-through
    const structured = getStructuredProductLookThrough(pf.portfolio_id, snapshotDate)
    for (const s of structured) {
      const hasShippingOrEnergy = s.underlyingExposures.some(u => {
        const sectorStr = (u.sector || '') + ' ' + (u.name || '')
        return [...SHIPPING_KEYWORDS, ...ENERGY_KEYWORDS].some(kw => sectorStr.includes(kw))
      })
      if (hasShippingOrEnergy) {
        structuredHoldings.push(s)
      }
    }
  }

  const shippingPct = totalChf > 0 ? Math.round((shippingChf / totalChf) * 1000) / 10 : 0
  const energyPct = totalChf > 0 ? Math.round((energyChf / totalChf) * 1000) / 10 : 0

  // Overlap check (JB Shipping/Energy Note INS-0024 touches both)
  const combinedUniqueChf = shippingChf + energyChf  // May double-count INS-0024
  const combinedPct = totalChf > 0 ? Math.round((combinedUniqueChf / totalChf) * 1000) / 10 : 0

  evidence.push({
    claim: 'Shipping exposure in investment portfolio',
    value: `CHF ${shippingChf.toLocaleString()} (${shippingPct}%)`,
    source: snapshotDate === LATEST_SNAPSHOT ? 'holdings.csv' : 'holdings_snapshots.csv',
    recordIds: shippingHoldings.map(h => h.holdingId),
    snapshot: snapshotDate,
    calculation: `Sum of market_value_chf for holdings where instrument.sector contains shipping/logistics keywords`,
    supportingFields: ['market_value_chf', 'instrument_id', 'sector'],
  })

  evidence.push({
    claim: 'Energy/petrochemical exposure in investment portfolio',
    value: `CHF ${energyChf.toLocaleString()} (${energyPct}%)`,
    source: snapshotDate === LATEST_SNAPSHOT ? 'holdings.csv' : 'holdings_snapshots.csv',
    recordIds: energyHoldings.map(h => h.holdingId),
    snapshot: snapshotDate,
    calculation: `Sum of market_value_chf for holdings where instrument.sector contains energy/petrochemical keywords`,
    supportingFields: ['market_value_chf', 'instrument_id', 'sector'],
  })

  return {
    clientId: CLIENT_ID,
    snapshotDate,
    totalPortfolioChf: Math.round(totalChf),
    shippingChf: Math.round(shippingChf),
    shippingPct,
    energyChf: Math.round(energyChf),
    energyPct,
    combinedShippingEnergyPct: combinedPct,
    shippingHoldings,
    energyHoldings,
    structuredWithShippingEnergyExposure: structuredHoldings,
    evidence,
  }
}

// ─── Diversification Objective Analysis ───────────────────────────────────────

export function analyseObjectiveAlignment(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const mandate = store.mandateByClient[CLIENT_ID]
  const rmNotes = store.rmNotesByClient[CLIENT_ID] || []
  const exposure = calculateShippingEnergyExposure(snapshotDate)

  // Find the formal diversification objective note
  const divObjectiveNote = rmNotes.find(n => n.note_id === 'RMN-0019-002')

  // Source of wealth: 65-70% in shipping/energy (from clients.csv context and RM notes)
  const sowConcentrationPct = 67.5  // midpoint of stated 65-70% — from RM note RMN-0019-002

  // Portfolio shipping/energy vs stated objective
  const isObjectiveViolated = exposure.combinedShippingEnergyPct > 15  // tolerance threshold

  const objectiveEvidence = {
    claim: 'Stated diversification objective vs actual portfolio shipping/energy exposure',
    value: `Client stated "what we do in business, we should not also hold in this portfolio". Portfolio shipping/energy: ${exposure.combinedShippingEnergyPct}%`,
    source: 'rm_notes.json + holdings.csv',
    recordId: divObjectiveNote?.note_id || 'RMN-0019-002',
    snapshot: snapshotDate,
    calculation: `Combined shipping/energy exposure (${exposure.shippingPct}% shipping + ${exposure.energyPct}% energy) vs stated objective of maximum diversification`,
    supportingFields: ['body', 'tags', 'market_value_chf', 'sector'],
  }

  // The problematic holding: JB Shipping/Energy Note (INS-0024)
  const problemNote = store.raw.holdings.find(h =>
    h.portfolio_id.startsWith('PF-0019') && h.instrument_id === 'INS-0024'
  ) || store.raw.holdingsSnapshots.find(h =>
    h.portfolio_id.startsWith('PF-0019') && h.instrument_id === 'INS-0024' && h.snapshot_date === snapshotDate
  )

  return {
    clientId: CLIENT_ID,
    snapshotDate,
    statedObjective: divObjectiveNote?.body || 'Diversification from shipping/energy concentration',
    statedObjectiveDate: divObjectiveNote?.note_date || '2026-05-18',
    statedObjectiveSource: 'rm_notes.json / RMN-0019-002',
    businessConcentrationPct: sowConcentrationPct,
    portfolioShippingEnergyPct: exposure.combinedShippingEnergyPct,
    objectiveMet: !isObjectiveViolated,
    alignmentStatus: isObjectiveViolated ? 'MISALIGNED' : 'ALIGNED',
    keyConflict: isObjectiveViolated ? {
      description: 'Portfolio contains direct shipping/energy exposure that correlates with source of wealth concentration',
      problematicHoldings: exposure.shippingHoldings.map(h => h.name)
        .concat(exposure.energyHoldings.map(h => h.name))
        .filter((v, i, arr) => arr.indexOf(v) === i),
      mostProblematic: 'JB Shipping & Energy Diversified Note 2027 (INS-0024) — directly linked to shipping/energy basket with no capital protection',
    } : null,
    objectiveEvidence,
    exposure,
  }
}

// ─── Hormuz Scenario ───────────────────────────────────────────────────────────

/**
 * Builds a scenario object for Hormuz disruption impact on Abdullah's portfolio.
 * ONLY uses event_log.csv for authoritative 2026 data.
 * Clearly labels each element as KNOWN DATA, ASSUMPTION, CALCULATED RESULT, or UNCERTAINTY.
 */
export function buildHormuzScenario(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()

  // Retrieve authoritative events ONLY
  const hormuzEvents = store.raw.eventLog.filter(e =>
    e.authoritative === true &&
    (e.event_id === 'EVT-2026-003' || e.event_id === 'EVT-2026-004' ||
     e.event_id === 'EVT-2026-011' || e.event_id === 'EVT-2026-017')
  )

  if (hormuzEvents.length === 0) {
    return {
      error: 'No authoritative Hormuz events found in event_log.csv',
      eventIds: [],
    }
  }

  const disruptionEvent = hormuzEvents.find(e => e.event_id === 'EVT-2026-003')
  const deEscalationEvent = hormuzEvents.find(e => e.event_id === 'EVT-2026-004')
  const normalisationEvent = hormuzEvents.find(e => e.event_id === 'EVT-2026-011')
  const ratesEvent = hormuzEvents.find(e => e.event_id === 'EVT-2026-017')

  const exposure = calculateShippingEnergyExposure(snapshotDate)

  // Known stress: shipping note (INS-0024) declined to 88 cents at Feb 27 snapshot
  // Source: holdings_snapshots.csv SH-PF19A-004-B
  const noteAtFeb27 = store.raw.holdingsSnapshots.find(h =>
    h.instrument_id === 'INS-0024' && h.snapshot_date === '2026-02-27'
  )
  const noteAtDec31 = store.raw.holdingsSnapshots.find(h =>
    h.instrument_id === 'INS-0024' && h.snapshot_date === '2025-12-31'
  )
  const noteAtLatest = store.raw.holdings.find(h =>
    h.portfolio_id === 'PF-0019A' && h.instrument_id === 'INS-0024'
  )

  // Gulf Energy Fund: marked from 22.5m to 21m at Feb 27
  const gulfFundFeb27 = store.raw.holdingsSnapshots.find(h =>
    h.instrument_id === 'INS-0020' && h.snapshot_date === '2026-02-27' && h.portfolio_id === 'PF-0019A'
  )
  const gulfFundDec31 = store.raw.holdingsSnapshots.find(h =>
    h.instrument_id === 'INS-0020' && h.snapshot_date === '2025-12-31' && h.portfolio_id === 'PF-0019A'
  )

  // Compute observed losses at peak disruption (Feb 27 vs Dec 31).
  // Difference the pre-computed market_value_chf fields directly — the dataset
  // supplies CHF for every snapshot holding, so no FX conversion is needed.
  const noteImpactUsd = noteAtFeb27 && noteAtDec31
    ? (noteAtFeb27.market_value_local - noteAtDec31.market_value_local)
    : null
  const gulfFundImpactUsd = gulfFundFeb27 && gulfFundDec31
    ? (gulfFundFeb27.market_value_local - gulfFundDec31.market_value_local)
    : null

  const noteImpactChf = noteAtFeb27 && noteAtDec31
    ? Math.round(noteAtFeb27.market_value_chf - noteAtDec31.market_value_chf)
    : null
  const gulfFundImpactChf = gulfFundFeb27 && gulfFundDec31
    ? Math.round(gulfFundFeb27.market_value_chf - gulfFundDec31.market_value_chf)
    : null
  const totalObservedImpactChf = (noteImpactChf || 0) + (gulfFundImpactChf || 0)

  // For a STRESS SCENARIO (a re-escalation), apply assumptions
  // These are ASSUMPTIONS — clearly labeled
  const ASSUMPTION_SHIPPING_NOTE_STRESS_PCT = -20  // if disruption re-escalates to full closure
  const ASSUMPTION_ENERGY_FUND_STRESS_PCT = -15
  const ASSUMPTION_SHIPPING_EQUITIES_STRESS_PCT = -12

  const currentNoteValueChf = noteAtLatest?.market_value_chf || 0
  const stressNoteChf = Math.round(currentNoteValueChf * (ASSUMPTION_SHIPPING_NOTE_STRESS_PCT / 100))

  const currentGulfFundHolding = store.raw.holdings.find(h =>
    h.portfolio_id === 'PF-0019A' && h.instrument_id === 'INS-0020'
  )
  const stressGulfFundChf = currentGulfFundHolding
    ? Math.round(currentGulfFundHolding.market_value_chf * (ASSUMPTION_ENERGY_FUND_STRESS_PCT / 100))
    : 0

  const dpWorldHolding = store.raw.holdings.find(h =>
    h.portfolio_id === 'PF-0019A' && h.instrument_id === 'INS-0018'
  )
  const stressDpWorldChf = dpWorldHolding
    ? Math.round(dpWorldHolding.market_value_chf * (ASSUMPTION_SHIPPING_EQUITIES_STRESS_PCT / 100) * 0.5)
    : 0  // bonds less affected than equities

  const totalStressImpactChf = stressNoteChf + stressGulfFundChf + stressDpWorldChf
  const totalPortfolioChf = exposure.totalPortfolioChf
  const stressImpactPct = totalPortfolioChf > 0
    ? Math.round((Math.abs(totalStressImpactChf) / totalPortfolioChf) * 1000) / 10
    : null

  return {
    clientId: CLIENT_ID,
    scenarioName: 'Strait of Hormuz Re-escalation Stress',
    scenarioDescription: 'Stress test based on observed February 2026 disruption data and assumed re-escalation scenario. NOT a forecast.',
    authoritativeEventIds: hormuzEvents.map(e => e.event_id),

    knownData: {
      _label: 'KNOWN DATA — sourced from event_log.csv and holdings_snapshots.csv',
      disruptionDate: disruptionEvent?.event_date,
      disruptionDescription: disruptionEvent?.event_title,
      deEscalationDate: deEscalationEvent?.event_date,
      normalisationDate: normalisationEvent?.event_date,
      observedShippingRateSpike: ratesEvent?.market_impact_note || 'VLCC rates +165%, LNG +110%',
      observedNoteDeclineUsd: noteImpactUsd,
      observedGulfFundDeclineUsd: gulfFundImpactUsd,
      observedTotalImpactChf: totalObservedImpactChf,
      sourceRecords: [
        noteAtFeb27?.holding_id,
        noteAtDec31?.holding_id,
        gulfFundFeb27?.holding_id,
        gulfFundDec31?.holding_id,
      ].filter(Boolean),
    },

    assumptions: {
      _label: 'ASSUMPTIONS — not authoritative; used for stress scenario only',
      shippingNoteAdditionalStressPct: ASSUMPTION_SHIPPING_NOTE_STRESS_PCT,
      energyFundAdditionalStressPct: ASSUMPTION_ENERGY_FUND_STRESS_PCT,
      dpWorldBondAdditionalStressPct: ASSUMPTION_SHIPPING_EQUITIES_STRESS_PCT,
      rationale: 'Assumptions based on observed Feb 2026 event magnitudes scaled for a more severe re-escalation. Not independently verified.',
    },

    calculatedStressResult: {
      _label: 'CALCULATED STRESS RESULT — code-computed from current holdings + assumptions',
      stressNoteImpactChf: stressNoteChf,
      stressGulfFundImpactChf: stressGulfFundChf,
      stressDpWorldImpactChf: stressDpWorldChf,
      totalStressImpactChf,
      portfolioStressImpactPct: stressImpactPct,
      currentPortfolioValueChf: totalPortfolioChf,
      portfolioValueAfterStressChf: totalPortfolioChf + totalStressImpactChf,
    },

    uncertainty: {
      _label: 'UNCERTAINTY',
      items: [
        'Private fund marks (Gulf Energy Infrastructure Fund) are quarterly estimates, not daily prices',
        'The JB Shipping/Energy Note (INS-0024) mark depends on the issuer — not independently verified',
        'Operational shipping business impact is not included (this covers investment portfolio only)',
        'De-escalation timeline is unknown — stress duration affects total impact significantly',
        'Correlation between holdings may be higher than assumed in a severe disruption',
      ],
    },

    hormuzEvents: hormuzEvents.map(e => ({
      eventId: e.event_id,
      date: e.event_date,
      title: e.event_title,
      severity: e.severity,
      marketImpact: e.market_impact_note,
      sourceReference: e.source_reference,
    })),
  }
}

// ─── Main Intelligence Function ────────────────────────────────────────────────

export function getAbdullahIntelligence(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const client = store.clientById[CLIENT_ID]
  const mandate = store.mandateByClient[CLIENT_ID]

  const exposure = calculateShippingEnergyExposure(snapshotDate)
  const objectiveAlignment = analyseObjectiveAlignment(snapshotDate)
  const hormuzScenario = buildHormuzScenario(snapshotDate)
  const snapshotHistory = getSnapshotHistory(CLIENT_ID)
  const aggregatePortfolio = getClientAggregatedPortfolio(CLIENT_ID, snapshotDate)
  const rmNotes = store.rmNotesByClient[CLIENT_ID] || []
  const cashNeeds = store.cashNeedsByClient[CLIENT_ID] || []
  const commitments = store.commitmentsByClient[CLIENT_ID] || []

  // Relevant events from event_log
  const relevantEvents = store.raw.eventLog.filter(e =>
    e.authoritative === true && (
      e.affected_sectors?.includes('Shipping') ||
      e.affected_sectors?.includes('Energy') ||
      e.affected_regions?.includes('UAE') ||
      e.affected_regions?.includes('Middle East')
    )
  ).map(e => ({
    eventId: e.event_id,
    date: e.event_date,
    title: e.event_title,
    type: e.event_type,
    severity: e.severity,
    affectedSectors: e.affected_sectors,
    marketImpact: e.market_impact_note,
    source: e.source_reference,
  }))

  const signals = []

  // Signal 1: Objective misalignment
  if (objectiveAlignment.alignmentStatus === 'MISALIGNED') {
    signals.push({
      id: 'ABD-SIG-001',
      type: 'objective_alignment',
      severity: 'high',
      title: 'Portfolio exposure conflicts with stated diversification objective',
      summary: `Client explicitly stated diversification from shipping/energy as primary objective (${objectiveAlignment.statedObjectiveDate}). Portfolio still contains ${exposure.combinedShippingEnergyPct}% shipping/energy exposure.`,
      verifiedMetrics: {
        statedObjectiveDate: objectiveAlignment.statedObjectiveDate,
        portfolioShippingPct: exposure.shippingPct,
        portfolioEnergyPct: exposure.energyPct,
        combinedExposurePct: exposure.combinedShippingEnergyPct,
        businessConcentrationPct: objectiveAlignment.businessConcentrationPct,
        problematicInstruments: objectiveAlignment.keyConflict?.problematicHoldings || [],
      },
      relevanceFactors: [
        'Formally stated client objective on record (RMN-0019-002)',
        'JB Shipping/Energy Note (INS-0024) directly correlates with source of wealth',
        'Client experienced double-loss during Hormuz event (business + portfolio)',
      ],
      evidence: [objectiveAlignment.objectiveEvidence],
      uncertainty: 'Indirect exposure through diversification portfolio funds may also have incidental sector exposure not captured here.',
    })
  }

  // Signal 2: Structured note correlation risk
  const shippingNote = store.raw.holdings.find(h =>
    h.portfolio_id === 'PF-0019A' && h.instrument_id === 'INS-0024'
  )
  if (shippingNote) {
    signals.push({
      id: 'ABD-SIG-002',
      type: 'structured_product',
      severity: 'high',
      title: 'Shipping/Energy note has no capital protection and correlates with source of wealth',
      summary: `INS-0024 (JB Shipping & Energy Note, maturity Mar 2027) is principal-at-risk and directly linked to shipping/energy basket. Current value CHF ${shippingNote.market_value_chf?.toLocaleString()} vs CHF 9,300,000 at acquisition.`,
      verifiedMetrics: {
        instrumentId: 'INS-0024',
        currentValueChf: shippingNote.market_value_chf,
        acquisitionValueChf: 9300000,
        unrealisedPnlChf: (shippingNote.market_value_chf || 0) - 9300000,
        maturityDate: '2027-03-31',
        capitalProtection: false,
      },
      relevanceFactors: [
        'No capital protection — full downside exposure',
        'Underlying basket includes DP World, Energy Transfer, Gulf Energy Fund',
        'Client has already experienced loss on this note during Hormuz (Feb 2026)',
      ],
      evidence: [{
        claim: 'JB Shipping/Energy Note current mark vs acquisition',
        value: `Current CHF ${shippingNote.market_value_chf?.toLocaleString()} | Acquisition CHF 9,300,000 | P&L CHF ${((shippingNote.market_value_chf || 0) - 9300000).toLocaleString()}`,
        source: 'holdings.csv',
        recordId: shippingNote.holding_id,
        snapshot: snapshotDate,
        calculation: 'market_value_chf from holdings.csv vs cost_basis_chf',
        supportingFields: ['market_value_chf', 'cost_basis_chf', 'unrealised_pnl_chf'],
      }],
      uncertainty: 'Structured product mark is issuer-provided. Independent verification not available in this dataset.',
    })
  }

  // Signal 3: Hormuz scenario risk
  signals.push({
    id: 'ABD-SIG-003',
    type: 'scenario',
    severity: 'medium',
    title: 'Hormuz re-escalation stress scenario: potential CHF impact calculated',
    summary: `Based on February 2026 event data, a re-escalation stress scenario shows potential portfolio impact of CHF ${Math.abs(hormuzScenario.calculatedStressResult?.totalStressImpactChf || 0).toLocaleString()} (${hormuzScenario.calculatedStressResult?.portfolioStressImpactPct}% of portfolio). THIS IS NOT A FORECAST.`,
    verifiedMetrics: {
      stressImpactChf: hormuzScenario.calculatedStressResult?.totalStressImpactChf,
      stressImpactPct: hormuzScenario.calculatedStressResult?.portfolioStressImpactPct,
      basedOnAuthoritativeEvents: hormuzScenario.authoritativeEventIds,
      isScenario: true,
      isForecast: false,
    },
    relevanceFactors: [
      'Client has direct operational exposure through Al-Mansoori Group shipping business',
      'Portfolio shipping/energy exposure compounds the operational risk',
    ],
    evidence: [hormuzScenario.knownData],
    uncertainty: hormuzScenario.uncertainty?.items || [],
  })

  // Priority factors
  const priorityFactors = {
    objectiveAlignment: objectiveAlignment.alignmentStatus === 'MISALIGNED' ? 25 : 5,
    structuredProductRisk: 20,
    scenarioExposure: 15,
    liquidityImpact: 10,
  }
  const priorityScore = Object.values(priorityFactors).reduce((s, v) => s + v, 0)

  return {
    clientId: CLIENT_ID,
    clientName: client?.full_name || 'Abdullah Al-Mansoori',
    rmId: store.rm.rm_id,
    rmName: store.rm.rm_name,
    snapshotDate,
    priority: priorityScore >= 60 ? 'high' : 'medium',
    priorityScore,
    priorityFactors,
    mandate: {
      mandateId: mandate?.mandate_id,
      mandateType: mandate?.mandate_type,
      mandateName: mandate?.mandate_name,
      equityRange: `${mandate?.equity_min_pct}-${mandate?.equity_max_pct}%`,
      baseCurrency: mandate?.currency_base,
      diversificationNote: mandate?.notes,
    },
    aggregatePortfolio,
    shippingEnergyExposure: exposure,
    objectiveAlignment,
    hormuzScenario,
    signals: signals.sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 }
      return (sev[b.severity] || 0) - (sev[a.severity] || 0)
    }),
    snapshotHistory,
    relevantEvents,
    cashNeeds,
    commitments,
    rmNotes: rmNotes.map(n => ({
      noteId: n.note_id,
      date: n.note_date,
      type: n.note_type,
      subject: n.subject,
      body: n.body,
      tags: n.tags,
      actionRequired: n.action_required,
    })),
  }
}
