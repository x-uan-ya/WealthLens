/**
 * margaretheIntelligence.js
 *
 * Margarethe Voss-Brenner (CL-0003) intelligence engine — OFFICIAL schema.
 *
 * Client: EUR base, "Conservative" risk profile, mandate CONS, portfolio PF-0005
 * ("Inherited - Under Review"). Story (all deterministic from official data @2026-08-26):
 *   - Equity is ~71.5% of the portfolio vs the CONS mandate maximum of 30% — a
 *     large suitability breach. Fixed Income is only ~9.1% vs a 45% minimum.
 *   - The single largest position, the Global Luxury & Consumer Brands Fund, is
 *     ~26.1% of the portfolio vs the CONS single-position maximum of 10%.
 *   - Confirmed EUR 3,400,000 German inheritance tax instalment (CN-004) due
 *     2026-10-01 .. 2026-12-31.
 *   - The client is a grieving, self-described conservative investor who inherited
 *     a portfolio she does not understand and wants "something safe and boring"
 *     (RM notes N-005 / N-006).
 *
 * GOVERNANCE:
 *   - Mandate checks are rules-based against mandates.csv, not AI-generated.
 *   - Evidence accompanies every signal. AI never calculates.
 */

import { loadAllData } from './dataLoader.js'
import {
  getClientAggregatedPortfolio,
  getHoldingsAtSnapshot,
  getSnapshotHistory,
  LATEST_SNAPSHOT,
} from './snapshotEngine.js'
import { getRelevantEvents } from './eventGrounding.js'

const CLIENT_ID = 'CL-0003'
const PORTFOLIO_ID = 'PF-0005'

// ─── Mandate Compliance Checker (official per-asset-class rows) ─────────────────

/**
 * Compares actual allocation (from getClientAggregatedPortfolio) against the
 * mandate rows (one row per asset_class in mandates.csv).
 * @param {Array} allocation [{ assetClass, weightPct }]
 * @param {Array} mandateRows [{ asset_class, min_pct, target_pct, max_pct, max_single_position_pct }]
 */
export function checkMandateAlignment(allocation, mandateRows) {
  const allocByClass = Object.fromEntries(allocation.map(a => [a.assetClass, a]))
  return (mandateRows || []).map(rule => {
    const actual = allocByClass[rule.asset_class]
    const actualPct = actual?.weightPct ?? 0
    const belowMin = typeof rule.min_pct === 'number' && actualPct < rule.min_pct
    const aboveMax = typeof rule.max_pct === 'number' && actualPct > rule.max_pct
    const breach = aboveMax ? 'ABOVE_MAX' : belowMin ? 'BELOW_MIN' : null
    return {
      assetClass: rule.asset_class,
      actualPct,
      mandateMin: rule.min_pct,
      mandateTarget: rule.target_pct,
      mandateMax: rule.max_pct,
      withinRange: breach === null,
      breach,
      severity: breach === 'ABOVE_MAX' ? 'breach' : breach === 'BELOW_MIN' ? 'warning' : 'ok',
      deviationPpts: aboveMax
        ? Math.round((actualPct - rule.max_pct) * 100) / 100
        : belowMin ? Math.round((actualPct - rule.min_pct) * 100) / 100 : 0,
    }
  })
}

// ─── Equity / Suitability Analysis ──────────────────────────────────────────────

export function calculateEquityExposure(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const holdings = getHoldingsAtSnapshot(PORTFOLIO_ID, snapshotDate)
  const pf = store.portfolioById[PORTFOLIO_ID]
  const mandateRows = store.mandateRowsByCode[pf?.mandate_code] || []
  const equityRule = mandateRows.find(r => r.asset_class === 'Equity')
  const singleMax = mandateRows[0]?.max_single_position_pct ?? null

  let totalBase = 0
  let equityBase = 0
  const equityHoldings = []
  let largest = null

  for (const h of holdings) {
    const v = h.market_value_base
    if (typeof v !== 'number') continue
    totalBase += v
    if ((h.asset_class || '') === 'Equity') {
      equityBase += v
      const row = { instrumentId: h.instrument_id, name: h.instrument_name, subClass: h.sub_asset_class, sector: h.sector, valueBase: Math.round(v), weightPct: h.weight_pct }
      equityHoldings.push(row)
    }
    if (!largest || (h.weight_pct || 0) > (largest.weightPct || 0)) {
      largest = { instrumentId: h.instrument_id, name: h.instrument_name, assetClass: h.asset_class, valueBase: Math.round(v), weightPct: h.weight_pct }
    }
  }

  const pct = (n) => (totalBase > 0 ? Math.round((n / totalBase) * 10000) / 100 : 0)
  const equityPct = pct(equityBase)
  const equityMax = equityRule?.max_pct ?? 30
  const equityBreachPpts = Math.round((equityPct - equityMax) * 100) / 100

  const largestExceedsSingleMax = singleMax != null && largest && (largest.weightPct || 0) > singleMax

  const evidence = [{
    claim: 'Equity allocation vs Conservative mandate maximum',
    value: `Equity ${equityPct}% vs CONS max ${equityMax}% (breach ${equityBreachPpts > 0 ? '+' : ''}${equityBreachPpts} ppts)`,
    source: 'holdings.csv + mandates.csv',
    recordId: PORTFOLIO_ID,
    snapshot: snapshotDate,
    calculation: `Sum of Equity market_value_base / total market_value_base vs max_pct for CONS Equity`,
    supportingFields: ['market_value_base', 'asset_class', 'max_pct'],
  }]

  return {
    clientId: CLIENT_ID,
    portfolioId: PORTFOLIO_ID,
    snapshotDate,
    baseCurrency: holdings[0]?.portfolio_ccy || 'EUR',
    totalBase: Math.round(totalBase),
    equityBase: Math.round(equityBase),
    equityPct,
    mandateEquityMax: equityMax,
    equityBreachPpts,
    equityHoldings: equityHoldings.sort((a, b) => b.weightPct - a.weightPct),
    largestPosition: largest,
    singlePositionMaxPct: singleMax,
    largestExceedsSingleMax,
    evidence,
  }
}

// ─── Cash Need Analysis ──────────────────────────────────────────────────────────

export function calculateCashCoverage(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const cashNeeds = store.cashNeedsByClient[CLIENT_ID] || []
  const holdings = getHoldingsAtSnapshot(PORTFOLIO_ID, snapshotDate)

  let cashBase = 0
  const cashPositions = []
  for (const h of holdings) {
    if ((h.asset_class || '') === 'Cash and Equivalents') {
      cashBase += h.market_value_base || 0
      cashPositions.push({ name: h.instrument_name, valueBase: Math.round(h.market_value_base || 0), currency: h.instrument_ccy })
    }
  }

  return cashNeeds.map(cn => {
    const dueDate = new Date(cn.due_from)
    const refDate = new Date(snapshotDate)
    const daysUntilDue = Math.round((dueDate - refDate) / (1000 * 60 * 60 * 24))
    const amount = cn.amount || 0
    // Cash need currency (EUR) matches portfolio base (EUR).
    const coverable = cashBase >= amount
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
      coverableFromCash: coverable,
      shortfallBase: Math.max(0, amount - cashBase),
      cashPositions,
      evidence: {
        claim: `Cash coverage for: ${cn.description}`,
        value: `Need ${amount.toLocaleString()} ${cn.currency} due ${cn.due_from} .. ${cn.due_to} | available cash ${Math.round(cashBase).toLocaleString()} ${cn.currency} | covered: ${coverable}`,
        source: 'planned_cash_needs.csv + holdings.csv',
        recordId: cn.need_id,
        snapshot: snapshotDate,
        calculation: `Sum of Cash and Equivalents market_value_base (${Math.round(cashBase).toLocaleString()}) vs need (${amount.toLocaleString()})`,
        supportingFields: ['amount', 'currency', 'due_from', 'due_to', 'market_value_base'],
      },
    }
  })
}

// ─── Suitability & Liquidity Stress Test (deterministic) ────────────────────────

function buildMargaretheScenario({ snapshotDate, equityAnalysis, cashCoverage, client }) {
  const tax = cashCoverage.find(cn => cn.needId === 'CN-004') || cashCoverage[0] || null
  const equityBase = equityAnalysis?.equityBase ?? null
  const portfolioBase = equityAnalysis?.totalBase ?? null
  const cashBase = tax?.availableCashBase ?? null

  // ── ASSUMPTION: broad equity decline (single, explicit) ──
  const ASSUMPTION_EQUITY_DECLINE_PCT = 20

  let calc = null
  if (typeof equityBase === 'number' && typeof portfolioBase === 'number' && portfolioBase > 0) {
    const equityLoss = Math.round(equityBase * (ASSUMPTION_EQUITY_DECLINE_PCT / 100))
    const portfolioAfter = portfolioBase - equityLoss
    const portfolioImpactPct = Math.round((equityLoss / portfolioBase) * 10000) / 100
    // Equity weight AFTER the decline (equity fell, other classes unchanged).
    const equityAfter = equityBase - equityLoss
    const equityWeightAfterPct = portfolioAfter > 0 ? Math.round((equityAfter / portfolioAfter) * 10000) / 100 : null
    const taxNeed = tax?.amount ?? null
    calc = {
      _label: 'CALCULATED STRESS RESULT — arithmetic on verified holding/mandate values + stated assumption',
      assumedEquityDeclinePct: ASSUMPTION_EQUITY_DECLINE_PCT,
      equityBeforeBase: equityBase,
      equityLossBase: equityLoss,
      equityAfterBase: equityAfter,
      portfolioBeforeBase: portfolioBase,
      portfolioAfterBase: portfolioAfter,
      portfolioImpactBase: -equityLoss,
      portfolioImpactPct: -portfolioImpactPct,
      equityWeightBeforePct: equityAnalysis?.equityPct ?? null,
      equityWeightAfterPct,
      mandateEquityMaxPct: equityAnalysis?.mandateEquityMax ?? null,
      stillExceedsEquityMax: typeof equityAnalysis?.mandateEquityMax === 'number' ? equityWeightAfterPct > equityAnalysis.mandateEquityMax : null,
      taxNeedBase: taxNeed,
      cashAvailableBase: cashBase,
      taxStillCoveredByCash: (cashBase != null && taxNeed != null) ? cashBase >= taxNeed : null,
      cashShortfallVsTaxBase: (cashBase != null && taxNeed != null) ? Math.max(0, taxNeed - cashBase) : null,
    }
  }

  return {
    clientId: CLIENT_ID,
    scenarioName: 'Suitability & Liquidity Stress Test',
    scenarioDescription:
      'Deterministic stress test: how the inherited, equity-heavy portfolio (already breaching the Conservative mandate) and the near-term inheritance-tax obligation respond to a broad equity decline. NOT a forecast.',
    authoritativeEventIds: [],

    knownData: {
      _label: 'KNOWN DATA — verified from holdings.csv, mandates.csv, planned_cash_needs.csv',
      riskProfile: client?.risk_profile ?? null,
      equityWeightPct: equityAnalysis?.equityPct ?? null,
      mandateEquityMaxPct: equityAnalysis?.mandateEquityMax ?? null,
      equityBreachPpts: equityAnalysis?.equityBreachPpts ?? null,
      largestPositionName: equityAnalysis?.largestPosition?.name ?? null,
      largestPositionWeightPct: equityAnalysis?.largestPosition?.weightPct ?? null,
      singlePositionMaxPct: equityAnalysis?.singlePositionMaxPct ?? null,
      portfolioValueBase: portfolioBase,
      inheritanceTaxNeedBase: tax?.amount ?? null,
      inheritanceTaxCurrency: tax?.currency ?? null,
      inheritanceTaxDueFrom: tax?.dueFrom ?? null,
      inheritanceTaxDueTo: tax?.dueTo ?? null,
      currentCashBase: cashBase,
      baseCurrency: equityAnalysis?.baseCurrency ?? 'EUR',
    },

    assumptions: {
      _label: 'ASSUMPTIONS — stated, not authoritative; used for this stress test only',
      equityDeclinePct: -ASSUMPTION_EQUITY_DECLINE_PCT,
      rationale:
        'A single hypothetical broad-equity decline is applied to the (already over-weight) equity book. Chosen for illustration; not derived from a forecast.',
    },

    calculatedStressResult: calc,

    affectedExposures: [
      equityAnalysis?.equityPct != null && {
        label: 'Equity allocation (Conservative mandate)',
        value: `${equityAnalysis.equityPct}% vs max ${equityAnalysis.mandateEquityMax}%`,
      },
      equityAnalysis?.largestPosition && {
        label: 'Largest single position',
        value: `${equityAnalysis.largestPosition.name} ${equityAnalysis.largestPosition.weightPct}% (single max ${equityAnalysis.singlePositionMaxPct}%)`,
      },
      tax?.amount != null && {
        label: 'Confirmed inheritance-tax requirement',
        value: `${tax.amount.toLocaleString()} ${tax.currency}${tax.dueFrom ? ` due ${tax.dueFrom}` : ''}`,
      },
    ].filter(Boolean),

    portfolioImplications: [
      calc && `A ${ASSUMPTION_EQUITY_DECLINE_PCT}% equity decline would reduce portfolio value by an estimated ${calc.equityLossBase.toLocaleString()} ${calc.taxNeedBase != null ? tax.currency : ''} (${calc.portfolioImpactPct}% of portfolio).`,
      calc && calc.stillExceedsEquityMax != null && (calc.stillExceedsEquityMax
        ? `Even after the decline, equity would remain about ${calc.equityWeightAfterPct}% — still far above the ${calc.mandateEquityMaxPct}% Conservative ceiling. The suitability breach is structural, not market-driven.`
        : `After the decline, equity would fall to about ${calc.equityWeightAfterPct}%, within the ${calc.mandateEquityMaxPct}% ceiling.`),
      calc && calc.taxStillCoveredByCash != null && (calc.taxStillCoveredByCash
        ? `The confirmed inheritance-tax need (${calc.taxNeedBase?.toLocaleString()} ${tax.currency}) is covered by cash (${calc.cashAvailableBase?.toLocaleString()} ${tax.currency}); the equity decline does not reduce the cash buffer directly.`
        : `Cash (${calc.cashAvailableBase?.toLocaleString()} ${tax.currency}) does NOT cover the confirmed tax need (${calc.taxNeedBase?.toLocaleString()} ${tax.currency}) — shortfall ${calc.cashShortfallVsTaxBase?.toLocaleString()} ${tax.currency}. Meeting it in a down market may force selling depressed equity.`),
    ].filter(Boolean),

    objectiveImplications: [
      'The client\u2019s objective is to understand and de-risk the inherited portfolio and secure stable income for a Conservative profile. The scenario shows why reducing equity ahead of the tax date matters: a decline forces her to either sell into weakness or leave the tax underfunded.',
    ],

    uncertainty: {
      items: [
        'The equity decline percentage is an illustrative assumption, not a forecast.',
        'Sector funds (luxury, tech, industrials) can fall more or less than a broad index.',
        'The final inheritance-tax amount is subject to German tax-authority confirmation.',
      ],
    },

    rmConsiderations: [
      'Review the equity over-weight and single-position concentration against the Conservative mandate before year end.',
      'Assess whether de-risking now secures the inheritance-tax payment without selling into a future decline.',
      'Handle sensitively: the client is grieving and asked that nothing be changed abruptly (RM note N-005).',
    ],

    evidence: [
      equityAnalysis?.evidence?.[0] && {
        label: equityAnalysis.evidence[0].claim,
        value: equityAnalysis.evidence[0].value,
        source: equityAnalysis.evidence[0].source,
        snapshot: equityAnalysis.evidence[0].snapshot,
        record: equityAnalysis.evidence[0].recordId,
      },
      tax?.evidence && {
        label: tax.evidence.claim,
        value: tax.evidence.value,
        source: tax.evidence.source,
        snapshot: tax.evidence.snapshot,
        record: tax.evidence.recordId,
      },
    ].filter(Boolean),
  }
}

// ─── Main Intelligence Function ────────────────────────────────────────────────

export function getMargartheIntelligence(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const client = store.clientById[CLIENT_ID]
  const pf = store.portfolioById[PORTFOLIO_ID]
  const mandateRows = store.mandateRowsByCode[pf?.mandate_code] || []
  const rmNotes = store.rmNotesByClient[CLIENT_ID] || []

  const equityAnalysis = calculateEquityExposure(snapshotDate)
  const aggregatePortfolio = getClientAggregatedPortfolio(CLIENT_ID, snapshotDate)
  const mandateChecks = checkMandateAlignment(aggregatePortfolio.allocation, mandateRows)
  const cashCoverage = calculateCashCoverage(snapshotDate)
  const snapshotHistory = getSnapshotHistory(CLIENT_ID)

  const relevantEvents = getRelevantEvents(CLIENT_ID, ['Europe', 'Global'], ['Rates', 'Equity risk', 'credit'])

  const signals = []

  // Signal 1: equity above Conservative mandate ceiling
  if (equityAnalysis.equityBreachPpts > 0) {
    signals.push({
      id: 'MAR-SIG-001',
      type: 'mandate_breach',
      severity: equityAnalysis.equityBreachPpts > 10 ? 'high' : 'medium',
      title: 'Equity allocation far exceeds the Conservative mandate ceiling',
      summary: `Equity is ${equityAnalysis.equityPct}% of the inherited portfolio vs the CONS maximum of ${equityAnalysis.mandateEquityMax}% — a breach of ${equityAnalysis.equityBreachPpts} ppts. The portfolio as transferred is not conservative.`,
      verifiedMetrics: {
        equityPct: equityAnalysis.equityPct,
        mandateEquityMax: equityAnalysis.mandateEquityMax,
        breachPpts: equityAnalysis.equityBreachPpts,
        equityBase: equityAnalysis.equityBase,
        baseCurrency: equityAnalysis.baseCurrency,
      },
      relevanceFactors: [
        'Client risk profile is Conservative and she asked for "something safe and boring" (RM note N-006)',
        'CONS mandate caps equity at ' + equityAnalysis.mandateEquityMax + '%',
        'The RM already recorded that the transferred portfolio is not conservative (RM note N-005)',
      ],
      evidence: equityAnalysis.evidence,
      uncertainty: null,
    })
  }

  // Signal 2: single-position concentration (Luxury fund)
  if (equityAnalysis.largestExceedsSingleMax && equityAnalysis.largestPosition) {
    const lp = equityAnalysis.largestPosition
    signals.push({
      id: 'MAR-SIG-002',
      type: 'concentration',
      severity: 'high',
      title: 'Single fund position exceeds the mandate single-position limit',
      summary: `${lp.name} is ${lp.weightPct}% of the portfolio vs the CONS single-position maximum of ${equityAnalysis.singlePositionMaxPct}%.`,
      verifiedMetrics: {
        instrumentId: lp.instrumentId,
        instrumentName: lp.name,
        weightPct: lp.weightPct,
        singlePositionMaxPct: equityAnalysis.singlePositionMaxPct,
        exceedsByPpts: Math.round((lp.weightPct - equityAnalysis.singlePositionMaxPct) * 100) / 100,
      },
      relevanceFactors: [
        'Inherited concentration the client does not understand (RM note N-005)',
        'Single-position risk is especially inconsistent with a Conservative profile',
      ],
      evidence: [{
        claim: 'Single-position concentration vs mandate limit',
        value: `${lp.name} ${lp.weightPct}% vs ${equityAnalysis.singlePositionMaxPct}% max`,
        source: 'holdings.csv + mandates.csv',
        recordId: PORTFOLIO_ID,
        snapshot: snapshotDate,
        calculation: 'weight_pct from holdings.csv vs max_single_position_pct from mandates.csv',
        supportingFields: ['weight_pct', 'max_single_position_pct'],
      }],
      uncertainty: null,
    })
  }

  // Signal 3: inheritance-tax cash need
  const tax = cashCoverage.find(cn => cn.needId === 'CN-004')
  if (tax) {
    signals.push({
      id: 'MAR-SIG-003',
      type: 'liquidity',
      severity: tax.daysUntilDue <= 120 ? 'high' : 'medium',
      title: 'German inheritance tax instalment due before year end',
      summary: `${tax.amount.toLocaleString()} ${tax.currency} (${tax.description}) is confirmed due ${tax.dueFrom} .. ${tax.dueTo}. Cash ${tax.coverableFromCash ? 'covers' : 'does NOT cover'} it (available ${tax.availableCashBase.toLocaleString()} ${tax.currency}).`,
      verifiedMetrics: {
        amount: tax.amount,
        currency: tax.currency,
        dueFrom: tax.dueFrom,
        dueTo: tax.dueTo,
        daysUntilDue: tax.daysUntilDue,
        availableCashBase: tax.availableCashBase,
        coverableFromCash: tax.coverableFromCash,
        shortfallBase: tax.shortfallBase,
      },
      relevanceFactors: [
        'Confirmed and flagged in RM note N-006',
        tax.coverableFromCash ? 'Currently coverable from cash' : 'Cash does not cover it — may require selling assets',
        'Selling equity to fund it would crystallise risk in a portfolio already over-weight equity',
      ],
      evidence: [tax.evidence],
      uncertainty: 'Final tax amount subject to German tax-authority confirmation.',
    })
  }

  const priorityFactors = {
    mandateSuitability: equityAnalysis.equityBreachPpts > 10 ? 30 : equityAnalysis.equityBreachPpts > 0 ? 15 : 0,
    concentrationRisk: equityAnalysis.largestExceedsSingleMax ? 20 : 5,
    liquidityUrgency: tax && tax.daysUntilDue <= 120 ? 25 : 15,
    lifeEventContext: 10, // recent inheritance, grieving conservative client
  }
  const priorityScore = Object.values(priorityFactors).reduce((s, v) => s + v, 0)

  const scenario = buildMargaretheScenario({ snapshotDate, equityAnalysis, cashCoverage, client })

  return {
    clientId: CLIENT_ID,
    clientName: client?.client_name || 'Margarethe Voss-Brenner',
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
      riskProfile: client?.risk_profile,
      baseCurrency: pf?.base_currency,
      equityBand: mandateBand(mandateRows, 'Equity'),
      fixedIncomeBand: mandateBand(mandateRows, 'Fixed Income'),
      singlePositionMaxPct: mandateRows[0]?.max_single_position_pct ?? null,
    },
    aggregatePortfolio,
    equityAnalysis,
    mandateChecks,
    cashCoverage,
    signals: sortBySeverity(signals),
    snapshotHistory,
    relevantEvents,
    lifeEventContext: {
      type: 'Inheritance settlement',
      description: 'Recently inherited portfolio "under review"; confirmed German inheritance-tax instalment due before year end',
      source: 'clients.csv objectives + rm_notes.json (N-005 / N-006) + planned_cash_needs.csv (CN-004)',
    },
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
