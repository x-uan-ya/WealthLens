/**
 * snapshotEngine.js
 *
 * Five-snapshot deterministic portfolio calculation engine.
 *
 * Supported snapshots:
 *   2025-12-31  | 2026-02-27  | 2026-03-31  | 2026-06-30  | 2026-08-26
 *
 * GOVERNANCE:
 *   - CALCULATE WITH CODE. No OpenAI for calculations.
 *   - All values returned are numbers computed from official dataset records.
 *   - Every output includes source record IDs for traceability.
 */

import { loadAllData } from './dataLoader.js'

export const SNAPSHOTS = [
  '2025-12-31',
  '2026-02-27',
  '2026-03-31',
  '2026-06-30',
  '2026-08-26',
]

export const LATEST_SNAPSHOT = '2026-08-26'

// ─── Core Snapshot Functions ───────────────────────────────────────────────────

/**
 * Returns holdings for a given portfolio at a given snapshot date.
 * Falls back to the latest (2026-08-26) data for snapshots without explicit records.
 */
export function getHoldingsAtSnapshot(portfolioId, snapshotDate) {
  const store = loadAllData()

  // For the latest snapshot, use the main holdings table
  if (snapshotDate === LATEST_SNAPSHOT) {
    const holdings = store.holdingsByPortfolio[portfolioId] || []
    return holdings.map(h => ({
      ...h,
      instrument: store.instrumentById[h.instrument_id] || null,
      _source: 'holdings.csv',
    }))
  }

  // For historical snapshots, use the snapshot table
  const snapshotMap = store.snapshotHoldingsByPortfolio[portfolioId] || {}
  const holdings = snapshotMap[snapshotDate] || []

  if (holdings.length === 0) {
    // No snapshot data available — return empty with note
    return []
  }

  return holdings.map(h => ({
    ...h,
    instrument: store.instrumentById[h.instrument_id] || null,
    _source: 'holdings_snapshots.csv',
  }))
}

/**
 * Calculates total portfolio value in CHF at a snapshot.
 * Uses sum of market_value_chf across all holdings.
 */
export function getPortfolioValueChf(portfolioId, snapshotDate) {
  const holdings = getHoldingsAtSnapshot(portfolioId, snapshotDate)
  if (holdings.length === 0) return { value: null, sourceRecords: [], note: 'No holdings data for this snapshot' }

  let total = 0
  const sourceRecords = []

  for (const h of holdings) {
    if (typeof h.market_value_chf === 'number') {
      total += h.market_value_chf
      sourceRecords.push(h.holding_id)
    }
  }

  return {
    value: Math.round(total),
    currency: 'CHF',
    snapshotDate,
    portfolioId,
    holdingCount: holdings.length,
    sourceRecords,
  }
}

/**
 * Asset allocation at a snapshot, grouped by asset_class.
 * Returns array of { assetClass, valueChf, weightPct } sorted by weight desc.
 */
export function getAssetAllocation(portfolioId, snapshotDate) {
  const holdings = getHoldingsAtSnapshot(portfolioId, snapshotDate)
  if (holdings.length === 0) return { allocation: [], totalChf: 0, snapshotDate, portfolioId }

  const byClass = {}
  let total = 0

  for (const h of holdings) {
    if (typeof h.market_value_chf !== 'number') continue
    const cls = h.asset_class || 'Unknown'
    byClass[cls] = (byClass[cls] || 0) + h.market_value_chf
    total += h.market_value_chf
  }

  const allocation = Object.entries(byClass)
    .map(([assetClass, valueChf]) => ({
      assetClass,
      valueChf: Math.round(valueChf),
      weightPct: total > 0 ? Math.round((valueChf / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.weightPct - a.weightPct)

  return {
    allocation,
    totalChf: Math.round(total),
    snapshotDate,
    portfolioId,
    _source: snapshotDate === LATEST_SNAPSHOT ? 'holdings.csv' : 'holdings_snapshots.csv',
  }
}

/**
 * Aggregates multiple portfolios for a client at a snapshot.
 * Returns combined value, combined allocation, and per-portfolio breakdown.
 */
export function getClientAggregatedPortfolio(clientId, snapshotDate) {
  const store = loadAllData()
  const portfolios = store.portfoliosByClient[clientId] || []

  if (portfolios.length === 0) {
    return { clientId, snapshotDate, totalChf: 0, portfolios: [], allocation: [] }
  }

  let grandTotal = 0
  const allocationMap = {}
  const portfolioBreakdowns = []

  for (const pf of portfolios) {
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)
    let pfTotal = 0
    const pfAlloc = {}

    for (const h of holdings) {
      if (typeof h.market_value_chf !== 'number') continue
      pfTotal += h.market_value_chf
      const cls = h.asset_class || 'Unknown'
      pfAlloc[cls] = (pfAlloc[cls] || 0) + h.market_value_chf
      allocationMap[cls] = (allocationMap[cls] || 0) + h.market_value_chf
      grandTotal += h.market_value_chf
    }

    portfolioBreakdowns.push({
      portfolioId: pf.portfolio_id,
      portfolioName: pf.portfolio_name,
      portfolioType: pf.portfolio_type,
      valueChf: Math.round(pfTotal),
      holdingCount: holdings.length,
      hasSnapshotData: holdings.length > 0,
      allocation: Object.entries(pfAlloc).map(([assetClass, v]) => ({
        assetClass,
        valueChf: Math.round(v),
        weightPct: pfTotal > 0 ? Math.round((v / pfTotal) * 1000) / 10 : 0,
      })),
    })
  }

  const combinedAllocation = Object.entries(allocationMap)
    .map(([assetClass, valueChf]) => ({
      assetClass,
      valueChf: Math.round(valueChf),
      weightPct: grandTotal > 0 ? Math.round((valueChf / grandTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.weightPct - a.weightPct)

  return {
    clientId,
    snapshotDate,
    totalChf: Math.round(grandTotal),
    portfolioCount: portfolios.length,
    portfolios: portfolioBreakdowns,
    allocation: combinedAllocation,
  }
}

/**
 * Compares two snapshots for a client: returns allocation and value changes.
 */
export function compareSnapshots(clientId, fromDate, toDate) {
  if (!SNAPSHOTS.includes(fromDate) || !SNAPSHOTS.includes(toDate)) {
    throw new Error(`Invalid snapshot dates. Supported: ${SNAPSHOTS.join(', ')}`)
  }

  const from = getClientAggregatedPortfolio(clientId, fromDate)
  const to = getClientAggregatedPortfolio(clientId, toDate)

  const valueChangeChf = to.totalChf - from.totalChf
  const valueChangePct = from.totalChf > 0
    ? Math.round((valueChangeChf / from.totalChf) * 10000) / 100
    : null

  // Build allocation change map
  const allocFrom = Object.fromEntries(from.allocation.map(a => [a.assetClass, a]))
  const allocTo = Object.fromEntries(to.allocation.map(a => [a.assetClass, a]))
  const allClasses = new Set([...Object.keys(allocFrom), ...Object.keys(allocTo)])

  const allocationChanges = Array.from(allClasses).map(cls => ({
    assetClass: cls,
    fromWeightPct: allocFrom[cls]?.weightPct ?? 0,
    toWeightPct: allocTo[cls]?.weightPct ?? 0,
    changePpts: Math.round(((allocTo[cls]?.weightPct ?? 0) - (allocFrom[cls]?.weightPct ?? 0)) * 10) / 10,
    fromValueChf: allocFrom[cls]?.valueChf ?? 0,
    toValueChf: allocTo[cls]?.valueChf ?? 0,
  })).sort((a, b) => Math.abs(b.changePpts) - Math.abs(a.changePpts))

  return {
    clientId,
    fromSnapshot: fromDate,
    toSnapshot: toDate,
    fromTotalChf: from.totalChf,
    toTotalChf: to.totalChf,
    valueChangeChf,
    valueChangePct,
    allocationChanges,
    fromPortfolios: from.portfolios,
    toPortfolios: to.portfolios,
  }
}

/**
 * Returns the full snapshot history for a client across all five snapshots.
 */
export function getSnapshotHistory(clientId) {
  return SNAPSHOTS.map(date => {
    const agg = getClientAggregatedPortfolio(clientId, date)
    return {
      snapshotDate: date,
      totalChf: agg.totalChf,
      hasData: agg.portfolios.some(p => p.hasSnapshotData),
      allocation: agg.allocation,
      portfolioCount: agg.portfolioCount,
    }
  })
}

/**
 * Sector/geography concentration at snapshot — relevant for Lau (real estate) and Abdullah (shipping/energy).
 * Groups holdings by sector field from instrument data.
 */
export function getSectorConcentration(portfolioId, snapshotDate) {
  const holdings = getHoldingsAtSnapshot(portfolioId, snapshotDate)
  const bySector = {}
  let total = 0

  for (const h of holdings) {
    if (typeof h.market_value_chf !== 'number') continue
    const sector = h.instrument?.sector || h.sub_class || 'Unknown'
    bySector[sector] = (bySector[sector] || 0) + h.market_value_chf
    total += h.market_value_chf
  }

  return Object.entries(bySector)
    .map(([sector, valueChf]) => ({
      sector,
      valueChf: Math.round(valueChf),
      weightPct: total > 0 ? Math.round((valueChf / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.weightPct - a.weightPct)
}

/**
 * Look-through for structured products: returns underlying exposure.
 * For holdings where the instrument is_structured=true and has underlying_instruments,
 * returns the proportional underlying instrument names.
 */
export function getStructuredProductLookThrough(portfolioId, snapshotDate) {
  const store = loadAllData()
  const holdings = getHoldingsAtSnapshot(portfolioId, snapshotDate)
  const results = []

  for (const h of holdings) {
    const inst = store.instrumentById[h.instrument_id]
    if (!inst || !inst.is_structured) continue

    const underlyingIds = (inst.underlying_instruments || '').split(';').filter(Boolean)
    const underlyings = underlyingIds.map(uid => store.instrumentById[uid.trim()]).filter(Boolean)

    results.push({
      holdingId: h.holding_id,
      instrumentId: h.instrument_id,
      instrumentName: inst.name,
      structureType: inst.sub_class,
      marketValueChf: h.market_value_chf,
      maturityDate: inst.maturity_date || null,
      notes: inst.notes || null,
      underlyingExposures: underlyings.map(u => ({
        instrumentId: u.instrument_id,
        name: u.name,
        sector: u.sector,
        assetClass: u.asset_class,
      })),
    })
  }

  return results
}

/**
 * Holding/exposure changes between two snapshots for a single portfolio.
 * Returns per-holding value and weight changes.
 */
export function getHoldingChanges(portfolioId, fromDate, toDate) {
  const fromHoldings = getHoldingsAtSnapshot(portfolioId, fromDate)
  const toHoldings = getHoldingsAtSnapshot(portfolioId, toDate)

  const fromMap = {}
  for (const h of fromHoldings) fromMap[h.instrument_id] = h

  const toMap = {}
  for (const h of toHoldings) toMap[h.instrument_id] = h

  const allInstruments = new Set([
    ...Object.keys(fromMap),
    ...Object.keys(toMap),
  ])

  const changes = []
  for (const instrId of allInstruments) {
    const from = fromMap[instrId]
    const to = toMap[instrId]
    const store = loadAllData()
    const inst = store.instrumentById[instrId]

    changes.push({
      instrumentId: instrId,
      instrumentName: inst?.name || instrId,
      assetClass: (from || to).asset_class,
      fromValueChf: from?.market_value_chf ?? 0,
      toValueChf: to?.market_value_chf ?? 0,
      valueChangeChf: (to?.market_value_chf ?? 0) - (from?.market_value_chf ?? 0),
      fromWeightPct: from?.weight_pct ?? 0,
      toWeightPct: to?.weight_pct ?? 0,
      weightChangePpts: Math.round(((to?.weight_pct ?? 0) - (from?.weight_pct ?? 0)) * 10) / 10,
      status: !from ? 'new' : !to ? 'exited' : 'existing',
    })
  }

  return changes.sort((a, b) => Math.abs(b.valueChangeChf) - Math.abs(a.valueChangeChf))
}
