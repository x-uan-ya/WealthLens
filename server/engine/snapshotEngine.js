/**
 * snapshotEngine.js
 *
 * Five-snapshot deterministic portfolio calculation engine, on the OFFICIAL
 * schema. All snapshots live in holdings.csv (one row per position per
 * snapshot_date); there is no separate snapshot file.
 *
 * GOVERNANCE:
 *   - CALCULATE WITH CODE. No AI for calculations.
 *   - Values are read from official records. USD (market_value_usd) is used for
 *     cross-client aggregation; base ccy (market_value_base) for within-client.
 *   - Every output can be traced to holding/portfolio records.
 */

import { loadAllData, SNAPSHOT_DATES } from './dataLoader.js'

export const SNAPSHOTS = SNAPSHOT_DATES
export const LATEST_SNAPSHOT = '2026-08-26'

// Preferred value field for a holding. Cross-client work uses USD; within a
// single client/portfolio the base ccy is exact and consistent.
const MV = (h, ccy = 'usd') => (ccy === 'base' ? h.market_value_base : h.market_value_usd)

// ─── Core Snapshot Functions ───────────────────────────────────────────────────

/**
 * Holdings for a portfolio at a snapshot, with instrument joined.
 */
export function getHoldingsAtSnapshot(portfolioId, snapshotDate) {
  const store = loadAllData()
  const rows = store.holdingsByPortfolioSnapshot[portfolioId]?.[snapshotDate] || []
  return rows.map(h => ({
    ...h,
    instrument: store.instrumentById[h.instrument_id] || null,
    _source: 'holdings.csv',
  }))
}

/**
 * Total portfolio value at a snapshot (base ccy), with source records.
 */
export function getPortfolioValue(portfolioId, snapshotDate, ccy = 'base') {
  const holdings = getHoldingsAtSnapshot(portfolioId, snapshotDate)
  if (holdings.length === 0) return { value: null, sourceRecords: [], note: 'No holdings for this snapshot' }
  let total = 0
  const sourceRecords = []
  for (const h of holdings) {
    const v = MV(h, ccy)
    if (typeof v === 'number') { total += v; sourceRecords.push(h.instrument_id) }
  }
  return { value: total, currency: ccy === 'base' ? holdings[0].portfolio_ccy : 'USD', snapshotDate, portfolioId, holdingCount: holdings.length, sourceRecords }
}

/**
 * Asset allocation at a snapshot, grouped by asset_class (base ccy weights).
 */
export function getAssetAllocation(portfolioId, snapshotDate, ccy = 'base') {
  const holdings = getHoldingsAtSnapshot(portfolioId, snapshotDate)
  if (holdings.length === 0) return { allocation: [], totalBase: 0, snapshotDate, portfolioId }
  const byClass = {}
  let total = 0
  for (const h of holdings) {
    const v = MV(h, ccy)
    if (typeof v !== 'number') continue
    const cls = h.asset_class || 'Unknown'
    byClass[cls] = (byClass[cls] || 0) + v
    total += v
  }
  const allocation = Object.entries(byClass)
    .map(([assetClass, value]) => ({ assetClass, value, weightPct: total > 0 ? Math.round((value / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.weightPct - a.weightPct)
  return { allocation, totalBase: total, snapshotDate, portfolioId, _source: 'holdings.csv' }
}

/**
 * Aggregate a client's portfolios at a snapshot. Uses USD so portfolios in
 * different base currencies can be summed consistently.
 */
export function getClientAggregatedPortfolio(clientId, snapshotDate) {
  const store = loadAllData()
  const portfolios = store.portfoliosByClient[clientId] || []
  if (portfolios.length === 0) return { clientId, snapshotDate, totalUsd: 0, portfolios: [], allocation: [] }

  let grandTotalUsd = 0
  const allocationMap = {}
  const portfolioBreakdowns = []

  for (const pf of portfolios) {
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)
    let pfUsd = 0
    const pfAlloc = {}
    for (const h of holdings) {
      const v = h.market_value_usd
      if (typeof v !== 'number') continue
      pfUsd += v
      const cls = h.asset_class || 'Unknown'
      pfAlloc[cls] = (pfAlloc[cls] || 0) + v
      allocationMap[cls] = (allocationMap[cls] || 0) + v
      grandTotalUsd += v
    }
    portfolioBreakdowns.push({
      portfolioId: pf.portfolio_id,
      portfolioName: pf.portfolio_name,
      serviceModel: pf.service_model,
      mandateCode: pf.mandate_code,
      baseCurrency: pf.base_currency,
      valueUsd: pfUsd,
      holdingCount: holdings.length,
      hasSnapshotData: holdings.length > 0,
      allocation: Object.entries(pfAlloc).map(([assetClass, v]) => ({
        assetClass, valueUsd: v, weightPct: pfUsd > 0 ? Math.round((v / pfUsd) * 1000) / 10 : 0,
      })),
    })
  }

  const allocation = Object.entries(allocationMap)
    .map(([assetClass, valueUsd]) => ({ assetClass, valueUsd, weightPct: grandTotalUsd > 0 ? Math.round((valueUsd / grandTotalUsd) * 1000) / 10 : 0 }))
    .sort((a, b) => b.weightPct - a.weightPct)

  return {
    clientId,
    snapshotDate,
    totalUsd: grandTotalUsd,
    portfolioCount: portfolios.length,
    portfolios: portfolioBreakdowns,
    allocation,
  }
}

/**
 * Compare two snapshots for a client (USD).
 */
export function compareSnapshots(clientId, fromDate, toDate) {
  if (!SNAPSHOTS.includes(fromDate) || !SNAPSHOTS.includes(toDate)) {
    throw new Error(`Invalid snapshot dates. Supported: ${SNAPSHOTS.join(', ')}`)
  }
  const from = getClientAggregatedPortfolio(clientId, fromDate)
  const to = getClientAggregatedPortfolio(clientId, toDate)
  const valueChangeUsd = to.totalUsd - from.totalUsd
  const valueChangePct = from.totalUsd > 0 ? Math.round((valueChangeUsd / from.totalUsd) * 10000) / 100 : null

  const allocFrom = Object.fromEntries(from.allocation.map(a => [a.assetClass, a]))
  const allocTo = Object.fromEntries(to.allocation.map(a => [a.assetClass, a]))
  const allClasses = new Set([...Object.keys(allocFrom), ...Object.keys(allocTo)])
  const allocationChanges = Array.from(allClasses).map(cls => ({
    assetClass: cls,
    fromWeightPct: allocFrom[cls]?.weightPct ?? 0,
    toWeightPct: allocTo[cls]?.weightPct ?? 0,
    changePpts: Math.round(((allocTo[cls]?.weightPct ?? 0) - (allocFrom[cls]?.weightPct ?? 0)) * 10) / 10,
  })).sort((a, b) => Math.abs(b.changePpts) - Math.abs(a.changePpts))

  return { clientId, fromSnapshot: fromDate, toSnapshot: toDate, fromTotalUsd: from.totalUsd, toTotalUsd: to.totalUsd, valueChangeUsd, valueChangePct, allocationChanges }
}

/**
 * Full snapshot history for a client across all five snapshots (USD totals +
 * allocation), for timeline rendering.
 */
export function getSnapshotHistory(clientId) {
  return SNAPSHOTS.map(date => {
    const agg = getClientAggregatedPortfolio(clientId, date)
    return {
      snapshotDate: date,
      totalUsd: agg.totalUsd,
      hasData: agg.portfolios.some(p => p.hasSnapshotData),
      allocation: agg.allocation,
      portfolioCount: agg.portfolioCount,
    }
  })
}

/**
 * Sector concentration at a snapshot (base ccy weights), across a client's
 * portfolios. Uses instrument sector where present, else holding sector.
 */
export function getClientSectorConcentration(clientId, snapshotDate) {
  const store = loadAllData()
  const portfolios = store.portfoliosByClient[clientId] || []
  const bySector = {}
  let total = 0
  for (const pf of portfolios) {
    const holdings = getHoldingsAtSnapshot(pf.portfolio_id, snapshotDate)
    for (const h of holdings) {
      const v = h.market_value_usd
      if (typeof v !== 'number') continue
      const sector = h.instrument?.sector || h.sector || 'Unknown'
      bySector[sector] = (bySector[sector] || 0) + v
      total += v
    }
  }
  return Object.entries(bySector)
    .map(([sector, valueUsd]) => ({ sector, valueUsd, weightPct: total > 0 ? Math.round((valueUsd / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.weightPct - a.weightPct)
}
