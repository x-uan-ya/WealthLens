/**
 * margaretheIntelligence.js
 *
 * Phase 5: Margarethe Voss-Brenner (CL-0003) intelligence engine.
 *
 * GOVERNANCE:
 *   - All mandate-checking is rules-based, not AI-generated.
 *   - Evidence structure accompanies every signal.
 *   - No financial calculations via AI.
 */

import { loadAllData } from './dataLoader.js'
import {
  getClientAggregatedPortfolio,
  getHoldingsAtSnapshot,
  getSnapshotHistory,
  LATEST_SNAPSHOT,
} from './snapshotEngine.js'

const CLIENT_ID = 'CL-0003'

// ─── Mandate Compliance Checker ────────────────────────────────────────────────

/**
 * Reusable mandate alignment function.
 * Takes actual allocation and mandate rules, returns compliance per asset class.
 */
export function checkMandateAlignment(allocation, mandate) {
  const checks = []

  // Map asset class names to mandate fields
  const rules = [
    {
      assetClass: 'Equity',
      min: mandate.equity_min_pct,
      max: mandate.equity_max_pct,
      field: 'equity',
    },
    {
      assetClass: 'Fixed Income',
      min: mandate.fixed_income_min_pct,
      max: mandate.fixed_income_max_pct,
      field: 'fixed_income',
    },
    {
      assetClass: 'Cash',
      min: mandate.cash_min_pct,
      max: mandate.cash_max_pct,
      field: 'cash',
    },
    {
      assetClass: 'Alternative',
      min: mandate.alternatives_min_pct,
      max: mandate.alternatives_max_pct,
      field: 'alternatives',
    },
    {
      assetClass: 'Multi-Asset',
      min: null,
      max: null,
      field: 'multi_asset',
      note: 'Treated as mixed — see fund-level equity proportion',
    },
    {
      assetClass: 'Structured',
      min: null,
      max: null,
      field: 'structured',
      note: 'Not explicitly bounded in mandate — treat as equity or fixed income by underlying',
    },
  ]

  for (const rule of rules) {
    const actual = allocation.find(a =>
      a.assetClass === rule.assetClass ||
      a.assetClass.toLowerCase() === rule.assetClass.toLowerCase()
    )
    const actualPct = actual?.weightPct ?? 0

    const withinRange = (rule.min === null || actualPct >= rule.min) &&
                        (rule.max === null || actualPct <= rule.max)
    const breach = (rule.min !== null && actualPct < rule.min)
      ? 'BELOW_MIN' : (rule.max !== null && actualPct > rule.max)
      ? 'ABOVE_MAX' : null

    checks.push({
      assetClass: rule.assetClass,
      actualPct,
      mandateMin: rule.min,
      mandateMax: rule.max,
      withinRange: breach === null,
      breach,
      note: rule.note || null,
      severity: breach === 'ABOVE_MAX' ? 'breach' : breach === 'BELOW_MIN' ? 'warning' : 'ok',
    })
  }

  return checks
}

// ─── Voss-Brenner Specific Analysis ───────────────────────────────────────────

/**
 * Calculates effective equity exposure for Voss-Brenner.
 * Key complication: JB Conservative MA Fund (INS-0036) has internal equity allocation
 * that must be looked through to assess mandate compliance.
 */
export function calculateEffectiveEquityExposure(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const portfolios = store.portfoliosByClient[CLIENT_ID] || []
  const evidence = []

  let totalChf = 0
  let directEquityChf = 0
  let maFundChf = 0
  let fixedIncomeChf = 0
  let cashChf = 0
  const holdingDetails = []

  // The MA fund's internal equity allocation per RM note (RMN-0003-002)
  // RM noted it is now 28% equity (above the fund's 20% target due to ECB cuts)
  const MA_FUND_EQUITY_PCT = 0.28  // ASSUMPTION documented by RM on 2026-07-28
  const MA_FUND_EQUITY_PCT_TARGET = 0.20  // Fund's stated target

  for (const pf of portfolios) {
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)
    for (const h of holdings) {
      if (typeof h.market_value_chf !== 'number') continue
      totalChf += h.market_value_chf

      const inst = store.instrumentById[h.instrument_id]
      const isMAFund = h.instrument_id === 'INS-0036'
      const isDirectEquity = h.asset_class === 'Equity'
      const isFixedIncome = h.asset_class === 'Fixed Income'
      const isCash = h.asset_class === 'Cash'

      if (isDirectEquity && !isMAFund) {
        directEquityChf += h.market_value_chf
        holdingDetails.push({
          holdingId: h.holding_id,
          portfolioId: pf.portfolio_id,
          name: inst?.name || h.instrument_id,
          assetClass: 'Equity (Direct)',
          valueChf: h.market_value_chf,
          weightPct: h.weight_pct,
          subClass: h.sub_class,
        })
      } else if (isMAFund) {
        maFundChf += h.market_value_chf
        holdingDetails.push({
          holdingId: h.holding_id,
          portfolioId: pf.portfolio_id,
          name: inst?.name || h.instrument_id,
          assetClass: 'Multi-Asset (contains equity)',
          valueChf: h.market_value_chf,
          weightPct: h.weight_pct,
          internalEquityPct: MA_FUND_EQUITY_PCT * 100,
          internalEquityChf: Math.round(h.market_value_chf * MA_FUND_EQUITY_PCT),
          rmNoteSource: 'RMN-0003-002 (2026-07-28)',
        })
      } else if (isFixedIncome) {
        fixedIncomeChf += h.market_value_chf
      } else if (isCash) {
        cashChf += h.market_value_chf
      }
    }
  }

  // Effective equity = direct equity + MA fund equity allocation
  const maFundEquityChf = Math.round(maFundChf * MA_FUND_EQUITY_PCT)
  const effectiveEquityChf = directEquityChf + maFundEquityChf
  const effectiveEquityPct = totalChf > 0
    ? Math.round((effectiveEquityChf / totalChf) * 1000) / 10
    : 0

  // Direct equity only
  const directEquityPct = totalChf > 0
    ? Math.round((directEquityChf / totalChf) * 1000) / 10
    : 0

  evidence.push({
    claim: 'Effective equity exposure including MA fund look-through',
    value: `Effective equity: ${effectiveEquityPct}% (Direct: ${directEquityPct}% + MA fund equity component: ${Math.round((maFundEquityChf / totalChf) * 1000) / 10}%)`,
    source: 'holdings.csv + rm_notes.json (RMN-0003-002)',
    recordIds: holdingDetails.map(h => h.holdingId),
    snapshot: snapshotDate,
    calculation: `Direct equity CHF ${directEquityChf.toLocaleString()} + (MA fund CHF ${maFundChf.toLocaleString()} × ${MA_FUND_EQUITY_PCT * 100}%) = CHF ${effectiveEquityChf.toLocaleString()} / Total CHF ${totalChf.toLocaleString()}`,
    supportingFields: ['market_value_chf', 'asset_class', 'instrument_id'],
    assumption: `MA fund internal equity allocation = ${MA_FUND_EQUITY_PCT * 100}% (from RM note RMN-0003-002 dated 2026-07-28; fund target is ${MA_FUND_EQUITY_PCT_TARGET * 100}%)`,
  })

  // Deutsche Bank single stock concentration
  const dbHolding = store.raw.holdings.find(h =>
    h.instrument_id === 'INS-0026' && h.portfolio_id === 'PF-0003A'
  )
  const dbWeightPct = dbHolding ? dbHolding.weight_pct : 0
  const mandateSingleIssuerMax = store.mandateByClient[CLIENT_ID]?.max_single_issuer_pct || 10

  return {
    clientId: CLIENT_ID,
    snapshotDate,
    totalChf: Math.round(totalChf),
    directEquityChf: Math.round(directEquityChf),
    directEquityPct,
    maFundChf: Math.round(maFundChf),
    maFundEquityChf,
    maFundEquityPct: Math.round((maFundChf / totalChf) * 1000) / 10,
    effectiveEquityChf: Math.round(effectiveEquityChf),
    effectiveEquityPct,
    fixedIncomeChf: Math.round(fixedIncomeChf),
    fixedIncomePct: totalChf > 0 ? Math.round((fixedIncomeChf / totalChf) * 1000) / 10 : 0,
    cashChf: Math.round(cashChf),
    cashPct: totalChf > 0 ? Math.round((cashChf / totalChf) * 1000) / 10 : 0,
    holdingDetails,
    deutscheBankWeightPct: dbWeightPct,
    deutscheBankExceedsSingleIssuerMax: dbWeightPct > mandateSingleIssuerMax,
    mandateSingleIssuerMax,
    maFundDriftNote: `MA fund equity allocation (${MA_FUND_EQUITY_PCT * 100}%) exceeds fund target (${MA_FUND_EQUITY_TARGET * 100}%) — RM flagged 2026-07-28`,
    evidence,
  }
}

// Constant to avoid circular reference
const MA_FUND_EQUITY_TARGET = 0.20

// ─── Cash Need Analysis ────────────────────────────────────────────────────────

export function calculateCashCoverage(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const cashNeeds = store.cashNeedsByClient[CLIENT_ID] || []

  // Liquid assets: cash deposits
  const portfolios = store.portfoliosByClient[CLIENT_ID] || []
  let totalCashChf = 0
  const cashPositions = []

  for (const pf of portfolios) {
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)
    for (const h of holdings) {
      if (h.asset_class === 'Cash' || h.sub_class === 'Cash Deposit') {
        totalCashChf += h.market_value_chf || 0
        cashPositions.push({
          holdingId: h.holding_id,
          portfolioId: pf.portfolio_id,
          valueChf: h.market_value_chf,
          currency: h.local_currency,
        })
      }
    }
  }

  return cashNeeds.map(cn => {
    const dueDate = new Date(cn.due_date)
    const refDate = new Date(snapshotDate)
    const daysUntilDue = Math.round((dueDate - refDate) / (1000 * 60 * 60 * 24))

    return {
      needId: cn.need_id,
      description: cn.description,
      amountLocal: cn.amount_local,
      currency: cn.currency,
      amountChf: cn.amount_chf,
      dueDate: cn.due_date,
      daysUntilDue,
      urgency: cn.urgency,
      status: cn.status,
      availableCashChf: Math.round(totalCashChf),
      canCoverFromCash: totalCashChf >= (cn.amount_chf || 0),
      shortfallChf: Math.max(0, (cn.amount_chf || 0) - totalCashChf),
      cashPositions,
      evidence: {
        claim: `Cash coverage for: ${cn.description}`,
        value: `Need CHF ${cn.amount_chf?.toLocaleString()} | Available cash CHF ${Math.round(totalCashChf).toLocaleString()} | Covered: ${totalCashChf >= (cn.amount_chf || 0)}`,
        source: 'planned_cash_needs.csv + holdings.csv',
        recordId: cn.need_id,
        snapshot: snapshotDate,
        calculation: `Sum of Cash holdings CHF ${Math.round(totalCashChf).toLocaleString()} vs need CHF ${cn.amount_chf?.toLocaleString()}`,
        supportingFields: ['amount_chf', 'market_value_chf', 'due_date'],
      },
    }
  })
}

// ─── Client-Specific Stress Scenario (deterministic, verified data only) ───────

/**
 * Suitability & Liquidity Stress Test for Margarethe Voss-Brenner.
 *
 * Question: what happens to portfolio suitability and liquidity resilience if
 * the inherited concentrated Deutsche Bank single-stock weakens before her
 * confirmed inheritance-tax obligation?
 *
 * GOVERNANCE:
 *   - KNOWN values come from verified engine outputs (DB weight/value,
 *     mandate limit, effective equity, cash, inheritance-tax need).
 *   - The ONLY assumption is a single, clearly-labelled DB decline %.
 *   - CALCULATED values are pure arithmetic on the KNOWN + ASSUMPTION values.
 *   - No fabricated figures, no AI.
 */
function buildMargaretheScenario({ equityAnalysis, cashCoverage, mandate, client }) {
  const dbValueChf = equityAnalysis?.holdingDetails?.find(h => /deutsche bank/i.test(h.name))?.valueChf
    ?? equityAnalysis?.directEquityChf
    ?? null
  const dbWeightPct = equityAnalysis?.deutscheBankWeightPct ?? null
  const issuerMax = equityAnalysis?.mandateSingleIssuerMax ?? mandate?.max_single_issuer_pct ?? null
  const portfolioChf = equityAnalysis?.totalChf ?? null
  const tax = cashCoverage?.find(cn => cn.needId === 'PCN-0003-001') || cashCoverage?.[0] || null
  const cashChf = tax?.availableCashChf ?? equityAnalysis?.cashChf ?? null

  // ── ASSUMPTION: Deutsche Bank single-stock decline (single, explicit) ──
  const ASSUMPTION_DB_DECLINE_PCT = 20

  // ── CALCULATED (arithmetic on verified inputs) ──
  let calc = null
  if (typeof dbValueChf === 'number' && typeof portfolioChf === 'number' && portfolioChf > 0) {
    const dbLossChf = Math.round(dbValueChf * (ASSUMPTION_DB_DECLINE_PCT / 100))
    const portfolioAfterChf = portfolioChf - dbLossChf
    const portfolioImpactPct = Math.round((dbLossChf / portfolioChf) * 10000) / 100
    const dbWeightAfterPct = Math.round(((dbValueChf - dbLossChf) / portfolioAfterChf) * 10000) / 100
    const taxNeed = tax?.amountChf ?? null
    // Cash is not the DB position, so the tax buffer is unchanged by an equity
    // decline; we surface the (unchanged) coverage explicitly for the RM.
    const cashSurplusVsTaxChf = (cashChf != null && taxNeed != null) ? cashChf - taxNeed : null
    calc = {
      _label: 'CALCULATED STRESS RESULT — arithmetic on verified holding/mandate values + stated assumption',
      assumedDbDeclinePct: ASSUMPTION_DB_DECLINE_PCT,
      dbValueBeforeChf: dbValueChf,
      dbLossChf,
      dbValueAfterChf: dbValueChf - dbLossChf,
      portfolioBeforeChf: portfolioChf,
      portfolioAfterChf,
      portfolioImpactChf: -dbLossChf,
      portfolioImpactPct: -portfolioImpactPct,
      dbWeightBeforePct: dbWeightPct,
      dbWeightAfterPct,
      issuerMaxPct: issuerMax,
      stillExceedsIssuerMax: typeof issuerMax === 'number' ? dbWeightAfterPct > issuerMax : null,
      taxNeedChf: taxNeed,
      cashAvailableChf: cashChf,
      cashSurplusVsTaxChf,
      taxStillCoveredByCash: (cashChf != null && taxNeed != null) ? cashChf >= taxNeed : null,
    }
  }

  return {
    clientId: CLIENT_ID,
    scenarioName: 'Suitability & Liquidity Stress Test',
    scenarioDescription:
      'Deterministic stress test: how portfolio suitability (single-issuer concentration for a Conservative mandate) and liquidity resilience respond if the inherited Deutsche Bank position weakens before the confirmed inheritance-tax instalment. NOT a forecast.',
    authoritativeEventIds: [],

    knownData: {
      _label: 'KNOWN DATA — verified from holdings.csv, mandates.csv, planned_cash_needs.csv',
      riskProfile: client?.risk_profile ?? null,
      deutscheBankWeightPct: dbWeightPct,
      deutscheBankValueChf: dbValueChf,
      mandateSingleIssuerMaxPct: issuerMax,
      effectiveEquityPct: equityAnalysis?.effectiveEquityPct ?? null,
      portfolioValueChf: portfolioChf,
      inheritanceTaxNeedChf: tax?.amountChf ?? null,
      inheritanceTaxNeedLocal: tax?.amountLocal ?? null,
      inheritanceTaxCurrency: tax?.currency ?? null,
      inheritanceTaxDueDate: tax?.dueDate ?? null,
      currentCashChf: cashChf,
    },

    assumptions: {
      _label: 'ASSUMPTIONS — stated, not authoritative; used for this stress test only',
      deutscheBankDeclinePct: -ASSUMPTION_DB_DECLINE_PCT,
      rationale:
        'A single hypothetical decline is applied to the concentrated Deutsche Bank single-stock. Chosen for illustration; not derived from a forecast.',
    },

    calculatedStressResult: calc,

    affectedExposures: [
      dbWeightPct != null && issuerMax != null && {
        label: 'Deutsche Bank single-issuer concentration',
        value: `${dbWeightPct}% vs mandate max ${issuerMax}%`,
      },
      tax?.amountChf != null && {
        label: 'Confirmed inheritance-tax requirement',
        value: `CHF ${tax.amountChf.toLocaleString()}${tax.dueDate ? ` due ${tax.dueDate}` : ''}`,
      },
    ].filter(Boolean),

    portfolioImplications: [
      calc && `A ${ASSUMPTION_DB_DECLINE_PCT}% decline in Deutsche Bank would reduce portfolio value by an estimated CHF ${calc.dbLossChf.toLocaleString()} (${calc.portfolioImpactPct}% of portfolio).`,
      calc && calc.stillExceedsIssuerMax != null && (calc.stillExceedsIssuerMax
        ? `Even after the decline, Deutsche Bank would remain above the ${calc.issuerMaxPct}% single-issuer limit (estimated ${calc.dbWeightAfterPct}%) — the suitability breach persists.`
        : `After the decline, Deutsche Bank would fall to an estimated ${calc.dbWeightAfterPct}%, within the ${calc.issuerMaxPct}% single-issuer limit.`),
      calc && calc.taxStillCoveredByCash != null && (calc.taxStillCoveredByCash
        ? `The confirmed inheritance-tax need (CHF ${calc.taxNeedChf?.toLocaleString()}) remains covered by cash (CHF ${calc.cashAvailableChf?.toLocaleString()}); the equity decline does not directly reduce the cash buffer.`
        : `The inheritance-tax need may not be fully covered by cash after this scenario.`),
    ].filter(Boolean),

    objectiveImplications: [
      'Client objective is to de-risk the inherited portfolio and secure stable income for a Conservative profile — a concentrated single-stock decline highlights why reducing issuer concentration ahead of the tax obligation is worth discussing.',
    ],

    uncertainty: {
      items: [
        'The Deutsche Bank decline percentage is an illustrative assumption, not a forecast.',
        'Single-stock moves can differ materially from broad-equity moves.',
        'Final inheritance-tax amount is subject to German tax-authority confirmation.',
      ],
    },

    rmConsiderations: [
      'Review the single-issuer concentration against the Conservative mandate limit.',
      'Discuss whether reducing the inherited Deutsche Bank position ahead of the tax date improves suitability and liquidity resilience.',
      'Confirm with the client the sentimental/other reasons for retaining the inherited position before any suitability action.',
    ],

    evidence: [
      equityAnalysis?.evidence?.[0] && {
        label: equityAnalysis.evidence[0].claim,
        value: equityAnalysis.evidence[0].value,
        source: equityAnalysis.evidence[0].source,
        snapshot: equityAnalysis.evidence[0].snapshot,
        record: (equityAnalysis.evidence[0].recordIds || []).join(', '),
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
  const mandate = store.mandateByClient[CLIENT_ID]
  const rmNotes = store.rmNotesByClient[CLIENT_ID] || []

  const equityAnalysis = calculateEffectiveEquityExposure(snapshotDate)
  const aggregatePortfolio = getClientAggregatedPortfolio(CLIENT_ID, snapshotDate)
  const mandateChecks = checkMandateAlignment(aggregatePortfolio.allocation, mandate)
  const cashCoverage = calculateCashCoverage(snapshotDate)
  const snapshotHistory = getSnapshotHistory(CLIENT_ID)

  // Relevant events (ECB, EUR, Germany)
  const relevantEvents = store.raw.eventLog.filter(e =>
    e.authoritative === true && (
      e.affected_regions?.includes('Europe') ||
      e.affected_regions?.includes('Germany') ||
      e.affected_sectors?.includes('Fixed Income') ||
      e.affected_sectors?.includes('EUR')
    )
  ).map(e => ({
    eventId: e.event_id,
    date: e.event_date,
    title: e.event_title,
    type: e.event_type,
    severity: e.severity,
    marketImpact: e.market_impact_note,
  }))

  const signals = []

  // Signal 1: Equity allocation above Conservative mandate ceiling
  const equityBreachPpts = equityAnalysis.effectiveEquityPct - (mandate?.equity_max_pct || 30)
  if (equityBreachPpts > 0) {
    signals.push({
      id: 'MAR-SIG-001',
      type: 'mandate_breach',
      severity: equityBreachPpts > 5 ? 'high' : 'medium',
      title: 'Effective equity allocation exceeds Conservative mandate ceiling',
      summary: `Effective equity (including MA fund look-through) is ${equityAnalysis.effectiveEquityPct}% vs mandate maximum of ${mandate?.equity_max_pct}%. Breach of ${Math.round(equityBreachPpts * 10) / 10} ppts.`,
      verifiedMetrics: {
        effectiveEquityPct: equityAnalysis.effectiveEquityPct,
        mandateEquityMax: mandate?.equity_max_pct,
        breachPpts: Math.round(equityBreachPpts * 10) / 10,
        directEquityPct: equityAnalysis.directEquityPct,
        maFundEquityContributionPct: Math.round((equityAnalysis.maFundEquityChf / equityAnalysis.totalChf) * 1000) / 10,
      },
      relevanceFactors: [
        'Client is Conservative profile — explicitly does not want additional risk',
        'Mandate equity ceiling is 30%',
        'MA fund equity drift (ECB rate cut induced) is the key driver',
        'Client asked for written analysis at 2026-07-28 review',
      ],
      evidence: equityAnalysis.evidence,
      uncertainty: 'MA fund internal equity allocation is from RM note (2026-07-28), not independently verified against fund factsheet.',
    })
  }

  // Signal 2: Deutsche Bank single-stock concentration
  if (equityAnalysis.deutscheBankExceedsSingleIssuerMax) {
    signals.push({
      id: 'MAR-SIG-002',
      type: 'concentration',
      severity: 'medium',
      title: 'Deutsche Bank single-stock exceeds mandate issuer limit',
      summary: `Deutsche Bank (INS-0026) represents ${equityAnalysis.deutscheBankWeightPct}% of PF-0003A vs mandate single-issuer maximum of ${equityAnalysis.mandateSingleIssuerMax}%.`,
      verifiedMetrics: {
        instrumentId: 'INS-0026',
        instrumentName: 'Deutsche Bank AG',
        weightPct: equityAnalysis.deutscheBankWeightPct,
        mandateSingleIssuerMax: equityAnalysis.mandateSingleIssuerMax,
        exceedsByPpts: Math.round((equityAnalysis.deutscheBankWeightPct - equityAnalysis.mandateSingleIssuerMax) * 10) / 10,
      },
      relevanceFactors: [
        'Inherited position — client has sentimental attachment',
        'Client acknowledged concentration concern at 2026-03-10 meeting',
        'Conservative profile makes single-stock concentration particularly inconsistent',
      ],
      evidence: [{
        claim: 'Deutsche Bank single-stock concentration in PF-0003A',
        value: `${equityAnalysis.deutscheBankWeightPct}% of PF-0003A vs ${equityAnalysis.mandateSingleIssuerMax}% mandate limit`,
        source: 'holdings.csv + mandates.csv',
        recordId: 'H-PF03A-003',
        snapshot: snapshotDate,
        calculation: `weight_pct from holdings.csv vs max_single_issuer_pct from mandates.csv`,
        supportingFields: ['weight_pct', 'max_single_issuer_pct'],
      }],
      uncertainty: 'Client sentimental attachment may affect willingness to reduce.',
    })
  }

  // Signal 3: Inheritance tax cash need
  const inheritanceTax = cashCoverage.find(cn => cn.needId === 'PCN-0003-001')
  if (inheritanceTax) {
    signals.push({
      id: 'MAR-SIG-003',
      type: 'liquidity',
      severity: inheritanceTax.daysUntilDue <= 90 ? 'high' : 'medium',
      title: 'German inheritance tax payment due Dec 2026',
      summary: `EUR 4.2m (CHF ${inheritanceTax.amountChf?.toLocaleString()}) inheritance tax instalment confirmed due ${inheritanceTax.dueDate}. ${inheritanceTax.daysUntilDue} days away. Cash ${inheritanceTax.canCoverFromCash ? 'covers' : 'does NOT cover'} this need.`,
      verifiedMetrics: {
        amountEur: inheritanceTax.amountLocal,
        amountChf: inheritanceTax.amountChf,
        dueDate: inheritanceTax.dueDate,
        daysUntilDue: inheritanceTax.daysUntilDue,
        availableCashChf: inheritanceTax.availableCashChf,
        canCoverFromCash: inheritanceTax.canCoverFromCash,
        shortfallChf: inheritanceTax.shortfallChf,
      },
      relevanceFactors: [
        'Confirmed with client and legal advisor (RMN-0003-001)',
        'Second instalment EUR 3.8m due Jun 2027 — also flagged',
        'Client does not want to sell bonds early',
      ],
      evidence: [inheritanceTax.evidence],
      uncertainty: 'Tax amount subject to final German tax authority confirmation.',
    })
  }

  // Priority factors
  const hasBreach = equityBreachPpts > 0
  const hasCriticalCash = inheritanceTax?.daysUntilDue <= 90
  const priorityFactors = {
    mandateSuitability: hasBreach ? 30 : 10,
    liquidityUrgency: hasCriticalCash ? 25 : 15,
    concentrationRisk: equityAnalysis.deutscheBankExceedsSingleIssuerMax ? 15 : 5,
    lifeEventContext: 15,  // inheritance + conservative profile
  }
  const priorityScore = Object.values(priorityFactors).reduce((s, v) => s + v, 0)

  // Client-specific stress scenario (deterministic, verified data only).
  const scenario = buildMargaretheScenario({
    equityAnalysis,
    cashCoverage,
    mandate,
    client,
  })

  return {
    clientId: CLIENT_ID,
    clientName: client?.full_name || 'Margarethe Voss-Brenner',
    rmId: store.rm.rm_id,
    rmName: store.rm.rm_name,
    snapshotDate,
    priority: priorityScore >= 70 ? 'high' : 'medium',
    priorityScore,
    priorityFactors,
    scenario,
    mandate: {
      mandateId: mandate?.mandate_id,
      mandateType: mandate?.mandate_type,
      mandateName: mandate?.mandate_name,
      riskProfile: client?.risk_profile,
      equityRange: `${mandate?.equity_min_pct}-${mandate?.equity_max_pct}%`,
      fixedIncomeRange: `${mandate?.fixed_income_min_pct}-${mandate?.fixed_income_max_pct}%`,
      singleIssuerMax: `${mandate?.max_single_issuer_pct}%`,
      baseCurrency: mandate?.currency_base,
      notes: mandate?.notes,
    },
    aggregatePortfolio,
    equityAnalysis,
    mandateChecks,
    cashCoverage,
    signals: signals.sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 }
      return (sev[b.severity] || 0) - (sev[a.severity] || 0)
    }),
    snapshotHistory,
    relevantEvents,
    lifeEventContext: {
      type: 'Inheritance settlement',
      description: 'German industrial family estate — ongoing tax settlement (2 instalments remaining)',
      age: 67,
      beneficiaries: 'Two adult children (Michael and Anna)',
      source: 'rm_notes.json / RMN-0003-003',
    },
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

// (equityBreachPpts is computed inside getMargartheIntelligence scope)
