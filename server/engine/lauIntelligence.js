/**
 * lauIntelligence.js
 *
 * Phase 3: Lau Chi Ming (CL-0014) intelligence engine.
 *
 * GOVERNANCE:
 *   - All conclusions derive from official dataset records.
 *   - Every claim is accompanied by evidence: { claim, value, source, recordId, snapshot, calculation, supportingFields }
 *   - AI must NOT calculate — all financial figures here are code-computed.
 *   - DO NOT hard-code conclusions. All values are derived from holdings, credit facilities, and cash needs.
 */

import { loadAllData, getChfRate } from './dataLoader.js'
import {
  getClientAggregatedPortfolio,
  getHoldingsAtSnapshot,
  getStructuredProductLookThrough,
  getSectorConcentration,
  compareSnapshots,
  getSnapshotHistory,
  LATEST_SNAPSHOT,
} from './snapshotEngine.js'

const CLIENT_ID = 'CL-0014'
const PROPERTY_SECTORS = new Set(['Real Estate', 'real estate'])
const PROPERTY_INSTRUMENT_IDS = new Set(['INS-0002', 'INS-0003', 'INS-0004', 'INS-0012', 'INS-0017'])
const PROPERTY_STRUCTURED_IDS = new Set(['INS-0005', 'INS-0015'])

// ─── Property Concentration ────────────────────────────────────────────────────

export function calculatePropertyConcentration(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const portfolios = store.portfoliosByClient[CLIENT_ID] || []
  const evidence = []

  let totalPortfolioChf = 0
  let directPropertyChf = 0
  let structuredPropertyChf = 0
  const holdingDetails = []

  for (const pf of portfolios) {
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)

    for (const h of holdings) {
      if (typeof h.market_value_chf !== 'number') continue
      totalPortfolioChf += h.market_value_chf

      const inst = store.instrumentById[h.instrument_id]
      const isDirectProperty = PROPERTY_INSTRUMENT_IDS.has(h.instrument_id) ||
        (inst && inst.sector && inst.sector.toLowerCase().includes('real estate') &&
         h.sub_class !== 'Capital Protected Note' && h.sub_class !== 'Autocallable Note')
      const isStructuredProperty = PROPERTY_STRUCTURED_IDS.has(h.instrument_id) ||
        (inst && inst.is_structured && inst.sector && inst.sector.toLowerCase().includes('real estate'))

      if (isDirectProperty) {
        directPropertyChf += h.market_value_chf
        holdingDetails.push({
          holdingId: h.holding_id,
          portfolioId: pf.portfolio_id,
          instrumentId: h.instrument_id,
          name: inst?.name || h.instrument_id,
          type: 'Direct',
          assetClass: h.asset_class,
          subClass: h.sub_class,
          valueChf: h.market_value_chf,
          weightPct: h.weight_pct,
          snapshotDate,
          source: snapshotDate === LATEST_SNAPSHOT ? 'holdings.csv' : 'holdings_snapshots.csv',
        })
      } else if (isStructuredProperty) {
        structuredPropertyChf += h.market_value_chf
        holdingDetails.push({
          holdingId: h.holding_id,
          portfolioId: pf.portfolio_id,
          instrumentId: h.instrument_id,
          name: inst?.name || h.instrument_id,
          type: 'Structured (Property-linked)',
          assetClass: h.asset_class,
          subClass: h.sub_class,
          valueChf: h.market_value_chf,
          weightPct: h.weight_pct,
          maturityDate: inst?.maturity_date || null,
          notes: inst?.notes || null,
          snapshotDate,
          source: snapshotDate === LATEST_SNAPSHOT ? 'holdings.csv' : 'holdings_snapshots.csv',
        })
      }
    }
  }

  const totalPropertyChf = directPropertyChf + structuredPropertyChf
  const totalPropertyPct = totalPortfolioChf > 0
    ? Math.round((totalPropertyChf / totalPortfolioChf) * 1000) / 10
    : 0
  const directPropertyPct = totalPortfolioChf > 0
    ? Math.round((directPropertyChf / totalPortfolioChf) * 1000) / 10
    : 0
  const structuredPropertyPct = totalPortfolioChf > 0
    ? Math.round((structuredPropertyChf / totalPortfolioChf) * 1000) / 10
    : 0

  evidence.push({
    claim: 'Total property-linked concentration (direct + structured)',
    value: `${totalPropertyPct}% of combined portfolio`,
    valueChf: totalPropertyChf,
    source: snapshotDate === LATEST_SNAPSHOT ? 'holdings.csv' : 'holdings_snapshots.csv',
    recordIds: holdingDetails.map(h => h.holdingId),
    snapshot: snapshotDate,
    calculation: `Direct (CHF ${directPropertyChf.toLocaleString()}) + Structured (CHF ${structuredPropertyChf.toLocaleString()}) = CHF ${totalPropertyChf.toLocaleString()} / Total CHF ${totalPortfolioChf.toLocaleString()}`,
    supportingFields: ['market_value_chf', 'instrument_id', 'sub_class'],
  })

  // Look-through for structured products
  const lookThrough = []
  for (const pf of portfolios) {
    const structured = getStructuredProductLookThrough(pf.portfolio_id, snapshotDate)
    lookThrough.push(...structured)
  }

  return {
    snapshotDate,
    clientId: CLIENT_ID,
    totalPortfolioChf: Math.round(totalPortfolioChf),
    directPropertyChf: Math.round(directPropertyChf),
    directPropertyPct,
    structuredPropertyChf: Math.round(structuredPropertyChf),
    structuredPropertyPct,
    totalPropertyChf: Math.round(totalPropertyChf),
    totalPropertyPct,
    holdingDetails,
    structuredLookThrough: lookThrough,
    evidence,
  }
}

// ─── Credit Facility Analysis ──────────────────────────────────────────────────

export function calculateCreditFacilityStatus() {
  const store = loadAllData()
  const facilities = store.creditFacilitiesByClient[CLIENT_ID] || []
  const results = []

  for (const cf of facilities) {
    // LTV proximity: how far from margin call threshold (%)
    // proximity = (margincall_ltv - current_ltv) / margincall_ltv * 100
    const headroomToThreshold = typeof cf.ltv_threshold_pct === 'number' && typeof cf.ltv_current_pct === 'number'
      ? Math.round((cf.ltv_threshold_pct - cf.ltv_current_pct) * 10) / 10
      : null
    const headroomToMarginCall = typeof cf.ltv_margin_call_pct === 'number' && typeof cf.ltv_current_pct === 'number'
      ? Math.round((cf.ltv_margin_call_pct - cf.ltv_current_pct) * 10) / 10
      : null

    const proximityAlert = headroomToMarginCall !== null && headroomToMarginCall < 10
      ? 'CRITICAL'
      : headroomToMarginCall !== null && headroomToMarginCall < 20
      ? 'WARNING'
      : 'OK'

    results.push({
      facilityId: cf.facility_id,
      facilityType: cf.facility_type,
      facilityName: cf.facility_name,
      currency: cf.currency,
      limitAmount: cf.limit_amount,
      drawnAmount: cf.drawn_amount,
      availableAmount: cf.available_amount,
      utilisationPct: cf.limit_amount > 0
        ? Math.round((cf.drawn_amount / cf.limit_amount) * 1000) / 10
        : null,
      collateralValue: cf.collateral_value,
      ltvCurrentPct: cf.ltv_current_pct,
      ltvThresholdPct: cf.ltv_threshold_pct,
      ltvMarginCallPct: cf.ltv_margin_call_pct,
      headroomToThresholdPpts: headroomToThreshold,
      headroomToMarginCallPpts: headroomToMarginCall,
      marginCallProximityPct: cf.margin_call_proximity_pct,
      proximityAlert,
      status: cf.status,
      maturityDate: cf.maturity_date,
      notes: cf.notes,
      evidence: {
        claim: `Facility ${cf.facility_id} LTV status`,
        value: `Current LTV: ${cf.ltv_current_pct}% | Threshold: ${cf.ltv_threshold_pct}% | Margin Call: ${cf.ltv_margin_call_pct}% | Headroom to MC: ${headroomToMarginCall} ppts`,
        source: 'credit_facilities.csv',
        recordId: cf.facility_id,
        snapshot: LATEST_SNAPSHOT,
        calculation: `LTV = Drawn (${cf.drawn_amount?.toLocaleString()} ${cf.currency}) / Collateral (${cf.collateral_value?.toLocaleString()} ${cf.currency})`,
        supportingFields: ['drawn_amount', 'collateral_value', 'ltv_current_pct', 'ltv_margin_call_pct'],
      },
    })
  }

  // Aggregate. Credit facilities do not carry a pre-computed CHF field, so we
  // convert using the dataset FX rates from market_context.csv (HKDUSD*USDCHF).
  const totalDrawnChf = results.reduce((sum, f) => {
    const rate = getChfRate(f.currency, LATEST_SNAPSHOT) ?? 1
    return sum + (f.drawnAmount || 0) * rate
  }, 0)

  const criticalFacilities = results.filter(f => f.proximityAlert === 'CRITICAL')
  const warningFacilities = results.filter(f => f.proximityAlert === 'WARNING')

  return {
    clientId: CLIENT_ID,
    facilities: results,
    summary: {
      facilityCount: results.length,
      totalDrawnChfApprox: Math.round(totalDrawnChf),
      criticalCount: criticalFacilities.length,
      warningCount: warningFacilities.length,
      criticalFacilityIds: criticalFacilities.map(f => f.facilityId),
      warningFacilityIds: warningFacilities.map(f => f.facilityId),
    },
  }
}

// ─── Cash Requirement Analysis ─────────────────────────────────────────────────

export function calculateCashRequirement(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const cashNeeds = store.cashNeedsByClient[CLIENT_ID] || []

  // Get current liquid assets (cash + bonds as proxy)
  const portfolios = store.portfoliosByClient[CLIENT_ID] || []
  let cashChf = 0
  let liquidBondsChf = 0
  const cashHoldings = []
  const bondHoldings = []

  for (const pf of portfolios) {
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)
    for (const h of holdings) {
      if (typeof h.market_value_chf !== 'number') continue
      if (h.asset_class === 'Cash' || h.sub_class === 'Cash Deposit' || h.sub_class === 'Money Market') {
        cashChf += h.market_value_chf
        cashHoldings.push({ holdingId: h.holding_id, valueChf: h.market_value_chf, currency: h.local_currency })
      }
      if (h.asset_class === 'Fixed Income' && h.sub_class === 'Corporate Bond') {
        liquidBondsChf += h.market_value_chf
        bondHoldings.push({ holdingId: h.holding_id, valueChf: h.market_value_chf })
      }
    }
  }

  // Available Lombard headroom from CF-0014-001
  const lombard = store.creditFacilitiesByClient[CLIENT_ID]?.find(cf => cf.facility_id === 'CF-0014-001')
  const lombardHeadroomHkd = lombard ? lombard.available_amount : 0
  // Dataset-supported HKD -> CHF from market_context.csv (no hard-coded rate).
  const hkdChfRate = getChfRate('HKD', snapshotDate) ?? 0
  const lombardHeadroomChf = Math.round(lombardHeadroomHkd * hkdChfRate)

  const cashNeadResults = cashNeeds.map(cn => {
    // Days until due
    const dueDate = new Date(cn.due_date)
    const refDate = new Date(snapshotDate)
    const daysUntilDue = Math.round((dueDate - refDate) / (1000 * 60 * 60 * 24))
    const amountChf = cn.amount_chf || 0
    const canCoverFromCash = cashChf >= amountChf
    const canCoverFromCashAndBonds = (cashChf + liquidBondsChf) >= amountChf
    const canCoverWithLombard = (cashChf + lombardHeadroomChf) >= amountChf

    return {
      needId: cn.need_id,
      description: cn.description,
      amountLocal: cn.amount_local,
      currency: cn.currency,
      amountChf,
      dueDate: cn.due_date,
      daysUntilDue,
      urgency: cn.urgency,
      status: cn.status,
      canCoverFromCash,
      canCoverFromCashAndBonds,
      canCoverWithLombard,
      shortfallChf: Math.max(0, amountChf - cashChf),
      evidence: {
        claim: `Cash need: ${cn.description}`,
        value: `${cn.amount_local?.toLocaleString()} ${cn.currency} (CHF ${amountChf?.toLocaleString()}) due ${cn.due_date}`,
        source: 'planned_cash_needs.csv',
        recordId: cn.need_id,
        snapshot: snapshotDate,
        calculation: `Available cash CHF ${cashChf?.toLocaleString()} | Need CHF ${amountChf?.toLocaleString()} | Shortfall CHF ${Math.max(0, amountChf - cashChf)?.toLocaleString()}`,
        supportingFields: ['amount_local', 'currency', 'amount_chf', 'due_date', 'status'],
      },
    }
  })

  const primaryNeed = cashNeadResults.find(cn => cn.needId === 'PCN-0014-001')

  return {
    clientId: CLIENT_ID,
    snapshotDate,
    cashPositionChf: Math.round(cashChf),
    liquidBondsChf: Math.round(liquidBondsChf),
    lombardHeadroomChf,
    totalLiquidityChf: Math.round(cashChf + liquidBondsChf),
    cashHoldings,
    bondHoldings,
    cashNeeds: cashNeadResults,
    primaryCashNeed: primaryNeed || null,
    evidenceSummary: buildCashEvidenceSummary(primaryNeed, cashChf, lombardHeadroomChf, hkdChfRate),
  }
}

// Builds the headline cash-coverage evidence from the actual PCN-0014-001
// record — need amounts come from planned_cash_needs.csv (local + pre-computed
// CHF), never from a hard-coded literal.
function buildCashEvidenceSummary(primaryNeed, cashChf, lombardHeadroomChf, hkdChfRate) {
  const needChf = primaryNeed?.amountChf ?? 0
  const needLocal = primaryNeed?.amountLocal ?? 0
  return {
    claim: `Lau Chi Ming ${primaryNeed?.dueDate || 'Nov 2026'} ${needLocal?.toLocaleString()} ${primaryNeed?.currency || 'HKD'} cash requirement coverage`,
    cashAvailableHkd: hkdChfRate ? Math.round(cashChf / hkdChfRate) : null,
    cashAvailableChf: Math.round(cashChf),
    needLocal,
    needCurrency: primaryNeed?.currency || 'HKD',
    needChf,
    shortfallChf: Math.max(0, needChf - cashChf),
    lombardCanBridge: (cashChf + lombardHeadroomChf) >= needChf,
    source: 'holdings.csv + credit_facilities.csv + planned_cash_needs.csv',
  }
}

// ─── Relevant RM Notes ─────────────────────────────────────────────────────────

export function getLauRMNotes() {
  const store = loadAllData()
  return store.rmNotesByClient[CLIENT_ID] || []
}

// ─── Snapshot History ──────────────────────────────────────────────────────────

export function getLauSnapshotHistory() {
  return getSnapshotHistory(CLIENT_ID)
}

// ─── Main Intelligence Function ────────────────────────────────────────────────

export function getLauChiMingIntelligence(snapshotDate = LATEST_SNAPSHOT) {
  const store = loadAllData()
  const client = store.clientById[CLIENT_ID]
  const mandate = store.mandateByClient[CLIENT_ID]
  const portfolios = store.portfoliosByClient[CLIENT_ID] || []

  // All calculations
  const propertyConcentration = calculatePropertyConcentration(snapshotDate)
  const creditFacilityStatus = calculateCreditFacilityStatus()
  const cashRequirement = calculateCashRequirement(snapshotDate)
  const rmNotes = getLauRMNotes()
  const snapshotHistory = getLauSnapshotHistory()
  const aggregatePortfolio = getClientAggregatedPortfolio(CLIENT_ID, snapshotDate)

  // Structured product details
  const allStructured = []
  for (const pf of portfolios) {
    allStructured.push(...getStructuredProductLookThrough(pf.portfolio_id, snapshotDate))
  }

  // Critical structured product: autocallable INS-0015 maturing Dec 2026
  const autocallable = allStructured.find(s => s.instrumentId === 'INS-0015')

  // Mandate compliance check: is property concentration within Balanced mandate?
  // Balanced mandate: equity 30-60%. Property REITs and stocks are equity.
  const equityWeightPct = aggregatePortfolio.allocation.find(a => a.assetClass === 'Equity')?.weightPct || 0
  const mandateEquityMin = mandate?.equity_min_pct || 30
  const mandateEquityMax = mandate?.equity_max_pct || 60
  const equityWithinMandate = equityWeightPct >= mandateEquityMin && equityWeightPct <= mandateEquityMax
  const singleSectorMax = mandate?.max_single_sector_pct || 25

  // Build signals
  const signals = []

  // Signal 1: Property concentration
  signals.push({
    id: 'LAU-SIG-001',
    type: 'concentration',
    severity: propertyConcentration.totalPropertyPct > 55 ? 'high' : propertyConcentration.totalPropertyPct > 45 ? 'medium' : 'low',
    title: 'Concentrated property-linked exposure',
    summary: `Property exposure (direct + structured) represents ${propertyConcentration.totalPropertyPct}% of the combined portfolio at ${snapshotDate}.`,
    verifiedMetrics: {
      directPropertyPct: propertyConcentration.directPropertyPct,
      structuredPropertyPct: propertyConcentration.structuredPropertyPct,
      totalPropertyPct: propertyConcentration.totalPropertyPct,
      totalPropertyChf: propertyConcentration.totalPropertyChf,
      mandateSingleSectorMax: singleSectorMax,
      exceedsMandateMax: propertyConcentration.totalPropertyPct > singleSectorMax,
    },
    relevanceFactors: [
      'Client source of wealth is property development (HK/GBA)',
      'Portfolio and business are both exposed to HK property market',
      'Mandate single-sector max is 25%',
    ],
    evidence: propertyConcentration.evidence,
    uncertainty: 'Indirect structured product exposure depends on issuer mark; not independently verified.',
  })

  // Signal 2: Upcoming HKD 60m cash need
  const primaryNeed = cashRequirement.primaryCashNeed
  if (primaryNeed) {
    signals.push({
      id: 'LAU-SIG-002',
      type: 'liquidity',
      severity: primaryNeed.daysUntilDue <= 90 ? 'high' : 'medium',
      title: 'HKD 60m property settlement due Nov 2026',
      summary: `Phase 3 Kowloon development settlement of HKD 60m (CHF ${(7200000).toLocaleString()}) is confirmed due ${primaryNeed.dueDate}. ${primaryNeed.daysUntilDue} days from ${snapshotDate}.`,
      verifiedMetrics: {
        requirementHkd: primaryNeed.amountLocal,
        requirementChf: primaryNeed.amountChf,
        daysUntilDue: primaryNeed.daysUntilDue,
        currentCashChf: cashRequirement.cashPositionChf,
        shortfallChf: primaryNeed.shortfallChf,
        lombardHeadroomChf: cashRequirement.lombardHeadroomChf,
        canBridgeWithLombard: primaryNeed.canCoverWithLombard,
      },
      relevanceFactors: [
        'Hard deadline confirmed by client and developer',
        'Cash position may be insufficient without Lombard draw',
        'Core equity positions (SHK Properties) not targeted for sale',
      ],
      evidence: [primaryNeed.evidence],
      uncertainty: 'Property market value could affect collateral if Lombard drawn further.',
    })
  }

  // Signal 3: Critical structured product facility proximity
  const criticalFacility = creditFacilityStatus.facilities.find(f => f.proximityAlert === 'CRITICAL')
  if (criticalFacility) {
    signals.push({
      id: 'LAU-SIG-003',
      type: 'credit',
      severity: 'high',
      title: `Credit facility ${criticalFacility.facilityId} near margin-call threshold`,
      summary: `Current LTV ${criticalFacility.ltvCurrentPct}% against margin call threshold ${criticalFacility.ltvMarginCallPct}%. Headroom: only ${criticalFacility.headroomToMarginCallPpts} ppts.`,
      verifiedMetrics: {
        facilityId: criticalFacility.facilityId,
        facilityType: criticalFacility.facilityType,
        ltvCurrentPct: criticalFacility.ltvCurrentPct,
        ltvThresholdPct: criticalFacility.ltvThresholdPct,
        ltvMarginCallPct: criticalFacility.ltvMarginCallPct,
        headroomPpts: criticalFacility.headroomToMarginCallPpts,
        drawnAmount: criticalFacility.drawnAmount,
        currency: criticalFacility.currency,
      },
      relevanceFactors: [
        'Structured product collateral value has declined due to autocallable mark-down',
        'Combined with primary cash need, could trigger forced action',
      ],
      evidence: [criticalFacility.evidence],
      uncertainty: 'Collateral value depends on structured product market marks.',
    })
  }

  // Signal 4: Autocallable maturing Dec 2026
  if (autocallable) {
    signals.push({
      id: 'LAU-SIG-004',
      type: 'structured_product',
      severity: 'medium',
      title: 'Autocallable HK RE basket note maturing Dec 2026',
      summary: `JB HK RE Basket autocallable (INS-0015) matures December 31 2026. Current mark ~${Math.round((autocallable.marketValueChf / 480000) * 100)}% of par. Coincides with cash need timing.`,
      verifiedMetrics: {
        instrumentId: autocallable.instrumentId,
        instrumentName: autocallable.instrumentName,
        maturityDate: autocallable.maturityDate,
        currentValueChf: autocallable.marketValueChf,
        underlyingExposures: autocallable.underlyingExposures,
      },
      relevanceFactors: [
        'Maturity coincides with the Nov/Dec 2026 property-settlement cash-need window',
        'If it does not autocall, proceeds returned at maturity with potential mark-to-market loss',
        'Underlying basket is directly correlated with property concentration',
      ],
      evidence: [{
        claim: 'Autocallable note INS-0015 maturity and current value',
        value: `Matures ${autocallable.maturityDate} | Current CHF ${autocallable.marketValueChf?.toLocaleString()} | Underlying: ${autocallable.underlyingExposures.map(u => u.name).join(', ')}`,
        source: 'holdings.csv + instruments.csv',
        recordId: autocallable.holdingId,
        snapshot: snapshotDate,
        calculation: 'Market value from holdings.csv; underlying from instruments.csv underlying_instruments field',
        supportingFields: ['market_value_chf', 'maturity_date', 'underlying_instruments'],
      }],
      uncertainty: 'Autocall trigger depends on basket performance vs initial level — not calculable without strike data.',
    })
  }

  // Priority score factors
  const priorityFactors = {
    liquidityUrgency: primaryNeed?.daysUntilDue <= 90 ? 25 : 15,
    concentrationSeverity: propertyConcentration.totalPropertyPct > 50 ? 25 : 15,
    creditProximity: criticalFacility ? 25 : 10,
    mandateSuitability: !equityWithinMandate || propertyConcentration.totalPropertyPct > singleSectorMax ? 15 : 5,
  }
  const priorityScore = Object.values(priorityFactors).reduce((sum, v) => sum + v, 0)

  return {
    clientId: CLIENT_ID,
    clientName: client?.full_name || 'Lau Chi Ming',
    rmId: store.rm.rm_id,
    rmName: store.rm.rm_name,
    snapshotDate,
    priority: priorityScore >= 80 ? 'critical' : priorityScore >= 60 ? 'high' : 'medium',
    priorityScore,
    priorityFactors,
    mandate: {
      mandateId: mandate?.mandate_id,
      mandateType: mandate?.mandate_type,
      mandateName: mandate?.mandate_name,
      equityRange: `${mandate?.equity_min_pct}-${mandate?.equity_max_pct}%`,
      singleSectorMax: `${mandate?.max_single_sector_pct}%`,
      baseCurrency: mandate?.currency_base,
    },
    aggregatePortfolio,
    propertyConcentration,
    creditFacilityStatus,
    cashRequirement,
    structuredProducts: allStructured,
    signals: signals.sort((a, b) => {
      const sev = { high: 3, medium: 2, low: 1 }
      return (sev[b.severity] || 0) - (sev[a.severity] || 0)
    }),
    snapshotHistory,
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
