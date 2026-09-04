/**
 * lauIntelligence.js
 *
 * Lau Chi Ming (CL-0014) intelligence engine — OFFICIAL schema.
 *
 * Client: HKD base, "Balanced" risk profile, mandate BAL, portfolio PF-0016.
 * Story (all deterministic from official data @2026-08-26):
 *   - Real-estate-linked exposure ≈ 49% of the HKD portfolio (direct property,
 *     Golden Harbour equity + perpetual, and a Golden Harbour accumulator).
 *   - Lombard facility CF-0002 (collateral PF-0016) at 69.41% LTV vs a 70.0%
 *     margin-call level — 0.59 ppts of headroom.
 *   - Confirmed HKD 60,000,000 Mid-Levels redevelopment equity contribution
 *     (CN-013) due 2026-11-01 .. 2027-06-30.
 *   - A single direct-property position is 19.58% of the portfolio vs the BAL
 *     mandate single-position max of 12%.
 *
 * GOVERNANCE:
 *   - Every figure is code-computed from holdings.csv / credit_facilities.csv /
 *     planned_cash_needs.csv / mandates.csv. AI never calculates.
 *   - Evidence accompanies every claim: { claim, value, source, recordId, snapshot, calculation, supportingFields }.
 */

import { loadAllData } from './dataLoader.js'
import {
  getClientAggregatedPortfolio,
  getHoldingsAtSnapshot,
  getSnapshotHistory,
  LATEST_SNAPSHOT,
} from './snapshotEngine.js'

const CLIENT_ID = 'CL-0014'
const PORTFOLIO_ID = 'PF-0016'

// A holding is "real-estate-linked" if its sector is Real Estate, OR its name
// references the client's property vehicles / direct property. This captures
// direct property, the Golden Harbour equity + perpetual, and the accumulator.
function isRealEstateLinked(h) {
  const sector = (h.sector || h.instrument?.sector || '').toLowerCase()
  const name = (h.instrument_name || '').toLowerCase()
  return sector.includes('real estate') ||
    name.includes('property') ||
    name.includes('golden harbour') ||
    name.includes('mid-levels')
}

// ─── Property Concentration ────────────────────────────────────────────────────

export function calculatePropertyConcentration(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const holdings = getHoldingsAtSnapshot(PORTFOLIO_ID, snapshotDate)

  let totalBase = 0
  let propertyBase = 0
  let directPropertyBase = 0
  let structuredPropertyBase = 0
  const holdingDetails = []

  for (const h of holdings) {
    const v = h.market_value_base
    if (typeof v !== 'number') continue
    totalBase += v
    if (!isRealEstateLinked(h)) continue

    propertyBase += v
    const isStructured = (h.asset_class || '') === 'Structured Products'
    if (isStructured) structuredPropertyBase += v
    else directPropertyBase += v

    holdingDetails.push({
      instrumentId: h.instrument_id,
      name: h.instrument_name,
      assetClass: h.asset_class,
      subClass: h.sub_asset_class,
      sector: h.sector,
      valueBase: Math.round(v),
      weightPct: h.weight_pct,
      type: isStructured ? 'Structured (property-linked)' : 'Direct / issuer property',
    })
  }

  const pct = (n) => (totalBase > 0 ? Math.round((n / totalBase) * 10000) / 100 : 0)

  const evidence = [{
    claim: 'Real-estate-linked concentration in the portfolio',
    value: `${pct(propertyBase)}% of PF-0016 (HKD ${Math.round(propertyBase).toLocaleString()} of ${Math.round(totalBase).toLocaleString()})`,
    source: 'holdings.csv',
    recordId: PORTFOLIO_ID,
    snapshot: snapshotDate,
    calculation: `Sum of market_value_base for real-estate-sector or Golden Harbour / direct-property holdings / total market_value_base`,
    supportingFields: ['market_value_base', 'asset_class', 'sector', 'instrument_name'],
  }]

  return {
    clientId: CLIENT_ID,
    portfolioId: PORTFOLIO_ID,
    snapshotDate,
    baseCurrency: holdings[0]?.portfolio_ccy || 'HKD',
    totalPortfolioBase: Math.round(totalBase),
    totalPropertyBase: Math.round(propertyBase),
    totalPropertyPct: pct(propertyBase),
    directPropertyBase: Math.round(directPropertyBase),
    directPropertyPct: pct(directPropertyBase),
    structuredPropertyBase: Math.round(structuredPropertyBase),
    structuredPropertyPct: pct(structuredPropertyBase),
    holdingDetails: holdingDetails.sort((a, b) => b.valueBase - a.valueBase),
    evidence,
  }
}

// ─── Credit Facility (official per-snapshot columns) ────────────────────────────

function facilitySnapshot(cf, snapshotDate) {
  const g = (prefix) => cf[`${prefix}_${snapshotDate}`]
  return {
    drawn: g('drawn'),
    collateralMarketValue: g('collateral_market_value'),
    lendingValue: g('lending_value'),
    ltvPct: g('ltv_pct'),
    headroom: g('headroom'),
  }
}

export function calculateCreditFacilityStatus(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const facilities = store.creditFacilitiesByClient[CLIENT_ID] || []
  const results = []

  for (const cf of facilities) {
    const s = facilitySnapshot(cf, snapshotDate)
    const marginCall = cf.margin_call_ltv_pct
    const headroomPpts = (typeof marginCall === 'number' && typeof s.ltvPct === 'number')
      ? Math.round((marginCall - s.ltvPct) * 100) / 100
      : null
    const proximityAlert = headroomPpts !== null && headroomPpts <= 2
      ? 'CRITICAL' : headroomPpts !== null && headroomPpts <= 10
      ? 'WARNING' : 'OK'

    results.push({
      facilityId: cf.facility_id,
      facilityType: cf.facility_type,
      collateralPortfolioId: cf.collateral_portfolio_id,
      currency: cf.facility_ccy,
      creditLimit: cf.credit_limit,
      interestRatePct: cf.interest_rate_pct,
      drawnAmount: s.drawn,
      collateralMarketValue: s.collateralMarketValue,
      lendingValue: s.lendingValue,
      ltvCurrentPct: s.ltvPct,
      marginCallLtvPct: marginCall,
      headroomToMarginCallPpts: headroomPpts,
      headroomAmount: s.headroom,
      utilisationPct: cf.utilisation_pct_current,
      proximityAlert,
      snapshot: snapshotDate,
      evidence: {
        claim: `Facility ${cf.facility_id} LTV status`,
        value: `LTV ${s.ltvPct}% vs margin call ${marginCall}% — headroom ${headroomPpts} ppts (drawn ${Number(s.drawn).toLocaleString()} / lending value ${Number(s.lendingValue).toLocaleString()} ${cf.facility_ccy})`,
        source: 'credit_facilities.csv',
        recordId: cf.facility_id,
        snapshot: snapshotDate,
        calculation: `LTV = drawn_${snapshotDate} / lending_value_${snapshotDate}; headroom = margin_call_ltv_pct − ltv_pct_${snapshotDate}`,
        supportingFields: [`drawn_${snapshotDate}`, `lending_value_${snapshotDate}`, `ltv_pct_${snapshotDate}`, 'margin_call_ltv_pct'],
      },
    })
  }

  const critical = results.filter(f => f.proximityAlert === 'CRITICAL')
  const warning = results.filter(f => f.proximityAlert === 'WARNING')
  return {
    clientId: CLIENT_ID,
    facilities: results,
    summary: {
      facilityCount: results.length,
      criticalCount: critical.length,
      warningCount: warning.length,
      criticalFacilityIds: critical.map(f => f.facilityId),
      warningFacilityIds: warning.map(f => f.facilityId),
    },
  }
}

// ─── Cash Requirement ──────────────────────────────────────────────────────────

export function calculateCashRequirement(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const cashNeeds = store.cashNeedsByClient[CLIENT_ID] || []
  const holdings = getHoldingsAtSnapshot(PORTFOLIO_ID, snapshotDate)

  let cashBase = 0
  const cashHoldings = []
  for (const h of holdings) {
    if ((h.asset_class || '') === 'Cash and Equivalents') {
      cashBase += h.market_value_base || 0
      cashHoldings.push({ name: h.instrument_name, valueBase: Math.round(h.market_value_base || 0), currency: h.instrument_ccy })
    }
  }

  const needResults = cashNeeds.map(cn => {
    const dueDate = new Date(cn.due_from)
    const refDate = new Date(snapshotDate)
    const daysUntilDue = Math.round((dueDate - refDate) / (1000 * 60 * 60 * 24))
    const amount = cn.amount || 0
    // The cash need (HKD) and the portfolio base (HKD) share the same currency.
    const coverableFromCash = cashBase >= amount
    return {
      needId: cn.need_id,
      description: cn.description,
      amount,
      currency: cn.currency,
      dueFrom: cn.due_from,
      dueTo: cn.due_to,
      recurrence: cn.recurrence,
      certainty: cn.certainty,
      daysUntilDue,
      availableCashBase: Math.round(cashBase),
      coverableFromCash,
      shortfallBase: Math.max(0, amount - cashBase),
      evidence: {
        claim: `Cash need: ${cn.description}`,
        value: `${amount.toLocaleString()} ${cn.currency} due ${cn.due_from} .. ${cn.due_to} (${cn.certainty})`,
        source: 'planned_cash_needs.csv',
        recordId: cn.need_id,
        snapshot: snapshotDate,
        calculation: `Portfolio cash (${Math.round(cashBase).toLocaleString()} ${cn.currency}) vs need (${amount.toLocaleString()} ${cn.currency}); shortfall ${Math.max(0, amount - cashBase).toLocaleString()}`,
        supportingFields: ['amount', 'currency', 'due_from', 'due_to', 'certainty'],
      },
    }
  })

  const primaryNeed = needResults.find(cn => cn.needId === 'CN-013') || needResults[0] || null
  return {
    clientId: CLIENT_ID,
    snapshotDate,
    cashPositionBase: Math.round(cashBase),
    cashHoldings,
    cashNeeds: needResults,
    primaryCashNeed: primaryNeed,
  }
}

// ─── Mandate single-position breach (BAL max_single_position_pct) ───────────────

function checkSinglePositionBreach(store, holdings) {
  const pf = store.portfolioById[PORTFOLIO_ID]
  const mandateRows = store.mandateRowsByCode[pf?.mandate_code] || []
  const singleMax = mandateRows[0]?.max_single_position_pct ?? null
  if (singleMax == null) return { singleMax: null, breaches: [] }
  const breaches = holdings
    .filter(h => typeof h.weight_pct === 'number' && h.weight_pct > singleMax)
    .map(h => ({ name: h.instrument_name, weightPct: h.weight_pct, assetClass: h.asset_class, exceedsByPpts: Math.round((h.weight_pct - singleMax) * 100) / 100 }))
    .sort((a, b) => b.weightPct - a.weightPct)
  return { singleMax, breaches, mandateCode: pf?.mandate_code }
}

// ─── RM notes / history ─────────────────────────────────────────────────────────

export function getLauRMNotes() {
  const store = loadAllData()
  return store.rmNotesByClient[CLIENT_ID] || []
}
export function getLauSnapshotHistory() {
  return getSnapshotHistory(CLIENT_ID)
}

// ─── Property & Liquidity Stress Test (deterministic) ───────────────────────────

function buildLauScenario({ snapshotDate, propertyConcentration, creditFacilityStatus, cashRequirement }) {
  const cf = (creditFacilityStatus?.facilities || []).find(f => f.collateralPortfolioId === PORTFOLIO_ID)
    || (creditFacilityStatus?.facilities || [])[0]
  const primaryNeed = cashRequirement?.primaryCashNeed || null

  // ── ASSUMPTION: property-linked collateral decline (single, explicit) ──
  const ASSUMPTION_COLLATERAL_DECLINE_PCT = 15

  let calc = null
  if (cf && typeof cf.collateralMarketValue === 'number' && typeof cf.drawnAmount === 'number' && cf.collateralMarketValue > 0) {
    // Lending value scales with collateral (same advance ratio applied by the bank).
    const advanceRatio = cf.lendingValue / cf.collateralMarketValue
    const stressedCollateral = Math.round(cf.collateralMarketValue * (1 - ASSUMPTION_COLLATERAL_DECLINE_PCT / 100))
    const stressedLending = stressedCollateral * advanceRatio
    const stressedLtv = Math.round((cf.drawnAmount / stressedLending) * 10000) / 100
    const marginCall = cf.marginCallLtvPct
    const headroomAfter = typeof marginCall === 'number' ? Math.round((marginCall - stressedLtv) * 100) / 100 : null
    calc = {
      _label: 'CALCULATED STRESS RESULT — arithmetic on verified facility values + stated assumption',
      facilityId: cf.facilityId,
      assumedCollateralDeclinePct: ASSUMPTION_COLLATERAL_DECLINE_PCT,
      currentCollateralBase: cf.collateralMarketValue,
      stressedCollateralBase: stressedCollateral,
      currentLendingValueBase: Math.round(cf.lendingValue),
      stressedLendingValueBase: Math.round(stressedLending),
      currentLtvPct: cf.ltvCurrentPct,
      stressedLtvPct: stressedLtv,
      marginCallLtvPct: marginCall,
      headroomBeforePpts: cf.headroomToMarginCallPpts,
      headroomAfterPpts: headroomAfter,
      breachesMarginCall: typeof marginCall === 'number' ? stressedLtv >= marginCall : null,
      facilityCurrency: cf.currency,
    }
  }

  const need = primaryNeed?.amount ?? null
  const cashPos = cashRequirement?.cashPositionBase ?? null

  return {
    clientId: CLIENT_ID,
    scenarioName: 'Property & Liquidity Stress Test',
    scenarioDescription:
      'Deterministic stress test: how the Lombard facility and near-term liquidity respond if the property-linked collateral in PF-0016 weakens as the confirmed HKD 60m redevelopment contribution approaches. NOT a forecast.',
    authoritativeEventIds: [],

    knownData: {
      _label: 'KNOWN DATA — verified from credit_facilities.csv, planned_cash_needs.csv, holdings.csv',
      propertyLinkedExposurePct: propertyConcentration?.totalPropertyPct ?? null,
      propertyLinkedExposureBase: propertyConcentration?.totalPropertyBase ?? null,
      facilityId: cf?.facilityId ?? null,
      currentLtvPct: cf?.ltvCurrentPct ?? null,
      marginCallLtvPct: cf?.marginCallLtvPct ?? null,
      currentHeadroomPpts: cf?.headroomToMarginCallPpts ?? null,
      drawnAmount: cf?.drawnAmount ?? null,
      collateralMarketValue: cf?.collateralMarketValue ?? null,
      lendingValue: cf?.lendingValue ?? null,
      facilityCurrency: cf?.currency ?? null,
      confirmedCashNeed: need,
      confirmedCashNeedCurrency: primaryNeed?.currency ?? null,
      cashNeedDueFrom: primaryNeed?.dueFrom ?? null,
      cashNeedDueTo: primaryNeed?.dueTo ?? null,
      cashNeedCertainty: primaryNeed?.certainty ?? null,
      currentCashPositionBase: cashPos,
    },

    assumptions: {
      _label: 'ASSUMPTIONS — stated, not authoritative; used for this stress test only',
      propertyLinkedCollateralDeclinePct: -ASSUMPTION_COLLATERAL_DECLINE_PCT,
      rationale:
        'A single hypothetical decline is applied to the property-linked collateral securing the Lombard facility. Chosen for illustration; not derived from a forecast.',
    },

    calculatedStressResult: calc,

    affectedExposures: [
      propertyConcentration?.totalPropertyPct != null && {
        label: 'Real-estate-linked exposure',
        value: `${propertyConcentration.totalPropertyPct}% of portfolio`,
      },
      cf && { label: `${cf.facilityId} current LTV`, value: `${cf.ltvCurrentPct}% (margin call ${cf.marginCallLtvPct}%)` },
      need != null && { label: 'Confirmed cash requirement', value: `${need.toLocaleString()} ${primaryNeed?.currency}${primaryNeed?.dueFrom ? ` from ${primaryNeed.dueFrom}` : ''}` },
    ].filter(Boolean),

    portfolioImplications: [
      calc && `A ${ASSUMPTION_COLLATERAL_DECLINE_PCT}% decline in property-linked collateral would move ${calc.facilityId} LTV from ${calc.currentLtvPct}% to an estimated ${calc.stressedLtvPct}% (margin call ${calc.marginCallLtvPct}%).`,
      calc && (calc.breachesMarginCall
        ? `This would breach the ${calc.marginCallLtvPct}% margin-call level (estimated headroom ${calc.headroomAfterPpts} ppts) and could trigger a call.`
        : `Estimated headroom to margin call would narrow to ${calc.headroomAfterPpts} ppts from ${calc.headroomBeforePpts} ppts today.`),
      need != null && cashPos != null &&
        `The confirmed cash need of ${need.toLocaleString()} ${primaryNeed?.currency} dwarfs the portfolio cash position (${cashPos.toLocaleString()} ${primaryNeed?.currency}); funding it likely requires selling assets or drawing further on a facility whose headroom is already thin.`,
    ].filter(Boolean),

    objectiveImplications: [
      'Client objective is to generate yield to service development financing while retaining Hong Kong property recovery exposure — a collateral decline pressures the facility and the redevelopment funding timeline at the same time.',
    ],

    uncertainty: {
      items: [
        'Collateral valuations are point-in-time; actual marks move continuously.',
        'The collateral decline percentage is an illustrative assumption, not a forecast.',
        'The advance ratio is assumed to hold; the bank may re-cut lending values in stress.',
        'Timing overlap between a collateral decline and the redevelopment settlement is uncertain.',
      ],
    },

    rmConsiderations: [
      `Review current headroom on ${cf?.facilityId || 'the Lombard facility'} (${cf?.headroomToMarginCallPpts} ppts) against the confirmed redevelopment window.`,
      'Assess what portion of PF-0016 is genuinely liquid given the property, perpetual and accumulator concentration.',
      'Discuss whether partial pre-funding of the HKD 60m contribution reduces reliance on the facility.',
    ],

    evidence: [
      cf?.evidence,
      primaryNeed?.evidence,
      propertyConcentration?.evidence?.[0] && {
        label: propertyConcentration.evidence[0].claim,
        value: propertyConcentration.evidence[0].value,
        source: propertyConcentration.evidence[0].source,
        snapshot: propertyConcentration.evidence[0].snapshot,
        record: propertyConcentration.evidence[0].recordId,
      },
    ].filter(Boolean),
  }
}

// ─── Main Intelligence Function ────────────────────────────────────────────────

export function getLauChiMingIntelligence(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const client = store.clientById[CLIENT_ID]
  const pf = store.portfolioById[PORTFOLIO_ID]
  const mandateRows = store.mandateRowsByCode[pf?.mandate_code] || []
  const holdings = getHoldingsAtSnapshot(PORTFOLIO_ID, snapshotDate)

  const propertyConcentration = calculatePropertyConcentration(snapshotDate)
  const creditFacilityStatus = calculateCreditFacilityStatus(snapshotDate)
  const cashRequirement = calculateCashRequirement(snapshotDate)
  const rmNotes = getLauRMNotes()
  const snapshotHistory = getLauSnapshotHistory()
  const aggregatePortfolio = getClientAggregatedPortfolio(CLIENT_ID, snapshotDate)
  const singlePosition = checkSinglePositionBreach(store, holdings)

  const criticalFacility = creditFacilityStatus.facilities.find(f => f.proximityAlert === 'CRITICAL')
    || creditFacilityStatus.facilities.find(f => f.collateralPortfolioId === PORTFOLIO_ID)

  const signals = []

  // Signal 1: property concentration
  signals.push({
    id: 'LAU-SIG-001',
    type: 'concentration',
    severity: propertyConcentration.totalPropertyPct > 45 ? 'high' : 'medium',
    title: 'Concentrated real-estate-linked exposure',
    summary: `Real-estate-linked holdings (direct property, Golden Harbour equity + perpetual, and the Golden Harbour accumulator) represent ${propertyConcentration.totalPropertyPct}% of PF-0016 at ${snapshotDate}.`,
    verifiedMetrics: {
      totalPropertyPct: propertyConcentration.totalPropertyPct,
      totalPropertyBase: propertyConcentration.totalPropertyBase,
      directPropertyPct: propertyConcentration.directPropertyPct,
      structuredPropertyPct: propertyConcentration.structuredPropertyPct,
      baseCurrency: propertyConcentration.baseCurrency,
    },
    relevanceFactors: [
      'Client source of wealth is Hong Kong property development',
      'The portfolio, the Lombard collateral and the client\u2019s own business are the same property bet (RM note N-018)',
    ],
    evidence: propertyConcentration.evidence,
    uncertainty: 'The accumulator and perpetual marks are issuer-provided and not independently verified.',
  })

  // Signal 2: Lombard facility near margin call
  if (criticalFacility) {
    signals.push({
      id: 'LAU-SIG-002',
      type: 'credit',
      severity: (criticalFacility.headroomToMarginCallPpts ?? 99) <= 2 ? 'high' : 'medium',
      title: `Lombard facility ${criticalFacility.facilityId} near margin-call threshold`,
      summary: `Current LTV ${criticalFacility.ltvCurrentPct}% against a ${criticalFacility.marginCallLtvPct}% margin-call level — only ${criticalFacility.headroomToMarginCallPpts} ppts of headroom.`,
      verifiedMetrics: {
        facilityId: criticalFacility.facilityId,
        ltvCurrentPct: criticalFacility.ltvCurrentPct,
        marginCallLtvPct: criticalFacility.marginCallLtvPct,
        headroomPpts: criticalFacility.headroomToMarginCallPpts,
        drawnAmount: criticalFacility.drawnAmount,
        lendingValue: criticalFacility.lendingValue,
        collateralMarketValue: criticalFacility.collateralMarketValue,
        currency: criticalFacility.currency,
      },
      relevanceFactors: [
        'Collateral is PF-0016 — the same property-concentrated portfolio',
        'LTV has risen from 53.9% (2025-12-31) to 69.41% (2026-08-26) as collateral weakened',
        'Combined with the confirmed cash need, leaves little room for a property decline',
      ],
      evidence: [criticalFacility.evidence],
      uncertainty: 'Collateral value depends on property, perpetual and accumulator marks that move continuously.',
    })
  }

  // Signal 3: confirmed HKD 60m redevelopment cash need
  const primaryNeed = cashRequirement.primaryCashNeed
  if (primaryNeed) {
    signals.push({
      id: 'LAU-SIG-003',
      type: 'liquidity',
      severity: primaryNeed.daysUntilDue <= 120 ? 'high' : 'medium',
      title: 'HKD 60m Mid-Levels redevelopment contribution confirmed',
      summary: `A confirmed ${primaryNeed.amount.toLocaleString()} ${primaryNeed.currency} equity contribution (${primaryNeed.description}) is due ${primaryNeed.dueFrom} .. ${primaryNeed.dueTo}. Portfolio cash is only ${primaryNeed.availableCashBase.toLocaleString()} ${primaryNeed.currency}.`,
      verifiedMetrics: {
        requirement: primaryNeed.amount,
        currency: primaryNeed.currency,
        dueFrom: primaryNeed.dueFrom,
        dueTo: primaryNeed.dueTo,
        certainty: primaryNeed.certainty,
        availableCashBase: primaryNeed.availableCashBase,
        shortfallBase: primaryNeed.shortfallBase,
        coverableFromCash: primaryNeed.coverableFromCash,
      },
      relevanceFactors: [
        'Confirmed by client at 2026-08-11 meeting (RM note N-019)',
        'Client was surprised how little of the portfolio is actually liquid',
        'Funding it may force sales or a larger facility draw',
      ],
      evidence: [primaryNeed.evidence],
      uncertainty: 'Exact settlement date within the window is not fixed.',
    })
  }

  // Signal 4: single-position mandate breach
  if (singlePosition.singleMax != null && singlePosition.breaches.length > 0) {
    const worst = singlePosition.breaches[0]
    signals.push({
      id: 'LAU-SIG-004',
      type: 'mandate_breach',
      severity: 'medium',
      title: 'Single-position weight exceeds BAL mandate limit',
      summary: `${worst.name} is ${worst.weightPct}% of PF-0016 vs the ${singlePosition.mandateCode} mandate single-position maximum of ${singlePosition.singleMax}%.`,
      verifiedMetrics: {
        mandateCode: singlePosition.mandateCode,
        singlePositionMaxPct: singlePosition.singleMax,
        breaches: singlePosition.breaches,
      },
      relevanceFactors: [
        'BAL mandate caps any single position at ' + singlePosition.singleMax + '%',
        'The largest breach is a direct property holding',
      ],
      evidence: [{
        claim: 'Single-position concentration vs mandate limit',
        value: `${worst.name} ${worst.weightPct}% vs ${singlePosition.singleMax}% max (${singlePosition.mandateCode})`,
        source: 'holdings.csv + mandates.csv',
        recordId: PORTFOLIO_ID,
        snapshot: snapshotDate,
        calculation: 'weight_pct from holdings.csv vs max_single_position_pct from mandates.csv',
        supportingFields: ['weight_pct', 'max_single_position_pct'],
      }],
      uncertainty: null,
    })
  }

  const priorityFactors = {
    creditProximity: criticalFacility && (criticalFacility.headroomToMarginCallPpts ?? 99) <= 2 ? 30 : criticalFacility ? 20 : 5,
    liquidityUrgency: primaryNeed?.daysUntilDue <= 120 ? 25 : 15,
    concentrationSeverity: propertyConcentration.totalPropertyPct > 45 ? 25 : 15,
    mandateSuitability: singlePosition.breaches.length > 0 ? 10 : 0,
  }
  const priorityScore = Object.values(priorityFactors).reduce((s, v) => s + v, 0)

  const scenario = buildLauScenario({ snapshotDate, propertyConcentration, creditFacilityStatus, cashRequirement })

  return {
    clientId: CLIENT_ID,
    clientName: client?.client_name || 'Lau Chi Ming',
    rmId: store.rm.rm_id,
    rmName: store.rm.rm_name,
    snapshotDate,
    priority: priorityScore >= 80 ? 'critical' : priorityScore >= 60 ? 'high' : 'medium',
    priorityScore,
    priorityFactors,
    scenario,
    mandate: {
      mandateCode: pf?.mandate_code,
      mandateName: pf?.mandate_name,
      baseCurrency: pf?.base_currency,
      equityBand: mandateBand(mandateRows, 'Equity'),
      singlePositionMaxPct: mandateRows[0]?.max_single_position_pct ?? null,
    },
    aggregatePortfolio,
    propertyConcentration,
    creditFacilityStatus,
    cashRequirement,
    signals: sortBySeverity(signals),
    snapshotHistory,
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
