/**
 * dataLoader.js
 *
 * Loads the OFFICIAL SingHacks 2026 Julius Baer dataset from server/data/.
 * Provides parsed, validated, normalised records against the official schema
 * documented in docs/DATA_DICTIONARY.md.
 *
 * GOVERNANCE:
 *   - event_log.csv is authoritative for 2026 geopolitical/market events.
 *   - No financial calculations are performed here — this is data loading only.
 *   - Monetary values are unrounded floats in three flavours per holding:
 *     market_value_local (instrument ccy), market_value_base (portfolio ccy),
 *     market_value_usd (common cross-client currency). Aggregation across
 *     clients uses market_value_usd.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../data')

// The five official snapshot dates (also declared in snapshotEngine).
export const SNAPSHOT_DATES = [
  '2025-12-31',
  '2026-02-27',
  '2026-03-31',
  '2026-06-30',
  '2026-08-26',
]

// ─── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(raw) {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const headers = splitCSVLine(lines[0])
  const records = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const values = splitCSVLine(line)
    const record = {}
    headers.forEach((h, idx) => {
      record[h.trim()] = (values[idx] ?? '').trim()
    })
    records.push(record)
  }
  return records
}

function splitCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function loadCSV(filename) {
  return parseCSV(readFileSync(join(DATA_DIR, filename), 'utf-8'))
}

function loadJSON(filename) {
  return JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf-8'))
}

// ─── Type Coercion ─────────────────────────────────────────────────────────────
//
// Coerce known-numeric columns to Number. Per-snapshot wide columns
// (aum_<date>, price_<date>, drawn_<date>, ltv_pct_<date>, etc.) are detected
// by prefix so we don't have to enumerate every dated column.

const NUMERIC_EXACT = new Set([
  // clients
  'age', 'total_aum_usd', 'risk_tolerance_score', 'investment_horizon_years',
  // portfolios
  'aum_usd_current',
  // holdings
  'quantity', 'price_local', 'market_value_local', 'market_value_base',
  'market_value_usd', 'weight_pct', 'avg_cost_local', 'cost_basis_base',
  'unrealised_pnl_base', 'unrealised_pnl_pct', 'lending_value_base', 'advance_rate_pct',
  // instruments (prices handled by prefix)
  // mandates
  'min_pct', 'target_pct', 'max_pct', 'max_single_position_pct',
  // transactions
  'amount',
  // credit facilities
  'credit_limit', 'interest_rate_pct', 'margin_call_ltv_pct', 'utilisation_pct_current',
  // commitments
  'committed', 'called_to_date', 'uncalled',
  // planned cash needs
  'amount',
  // market context
  'value',
])

const NUMERIC_PREFIXES = ['aum_', 'price_', 'drawn_', 'collateral_market_value_', 'lending_value_', 'ltv_pct_', 'headroom_']

function isNumericField(key) {
  if (NUMERIC_EXACT.has(key)) return true
  return NUMERIC_PREFIXES.some(p => key.startsWith(p))
}

function coerce(records) {
  return records.map(r => {
    const out = { ...r }
    for (const key of Object.keys(out)) {
      const v = out[key]
      if (v === '' || v == null) continue
      if (isNumericField(key)) {
        const n = Number(v)
        if (!isNaN(n)) out[key] = n
      }
    }
    return out
  })
}

// ─── Load All Datasets ─────────────────────────────────────────────────────────

let _cache = null

export function loadAllData() {
  if (_cache) return _cache

  const eventLogRaw = coerce(loadCSV('event_log.csv'))
  // event_log.csv has no id column; synthesise a stable id by row order.
  const eventLog = eventLogRaw.map((e, i) => ({
    ...e,
    event_id: `EVT-${String(i + 1).padStart(3, '0')}`,
    authoritative: true, // the official event log is the authority for 2026
  }))

  const raw = {
    clients:          coerce(loadCSV('clients.csv')),
    portfolios:       coerce(loadCSV('portfolios.csv')),
    holdings:         coerce(loadCSV('holdings.csv')),
    instruments:      coerce(loadCSV('instruments.csv')),
    mandates:         coerce(loadCSV('mandates.csv')),
    transactions:     coerce(loadCSV('transactions.csv')),
    creditFacilities: coerce(loadCSV('credit_facilities.csv')),
    commitments:      coerce(loadCSV('commitments.csv')),
    plannedCashNeeds: coerce(loadCSV('planned_cash_needs.csv')),
    marketContext:    coerce(loadCSV('market_context.csv')),
    eventLog,
    rmNotes:          loadJSON('rm_notes.json'), // flat array
  }

  _cache = buildNormalisedStore(raw)
  return _cache
}

// ─── Normalised Store ──────────────────────────────────────────────────────────

function buildNormalisedStore(raw) {
  const clientById = Object.fromEntries(raw.clients.map(c => [c.client_id, c]))
  const portfolioById = Object.fromEntries(raw.portfolios.map(p => [p.portfolio_id, p]))
  const instrumentById = Object.fromEntries(raw.instruments.map(i => [i.instrument_id, i]))

  // Mandates: one row per mandate_code × asset_class. Group by code.
  const mandateRowsByCode = {}
  for (const m of raw.mandates) {
    if (!mandateRowsByCode[m.mandate_code]) mandateRowsByCode[m.mandate_code] = []
    mandateRowsByCode[m.mandate_code].push(m)
  }

  // Client → portfolios
  const portfoliosByClient = {}
  for (const p of raw.portfolios) {
    (portfoliosByClient[p.client_id] ??= []).push(p)
  }

  // Holdings indexed by portfolio → snapshot_date → rows (all snapshots in one file)
  const holdingsByPortfolioSnapshot = {}
  for (const h of raw.holdings) {
    const byDate = (holdingsByPortfolioSnapshot[h.portfolio_id] ??= {})
    ;(byDate[h.snapshot_date] ??= []).push(h)
  }

  // Credit facilities by client (+ by collateral portfolio)
  const creditFacilitiesByClient = {}
  const creditFacilitiesByPortfolio = {}
  for (const cf of raw.creditFacilities) {
    (creditFacilitiesByClient[cf.client_id] ??= []).push(cf)
    if (cf.collateral_portfolio_id) {
      (creditFacilitiesByPortfolio[cf.collateral_portfolio_id] ??= []).push(cf)
    }
  }

  // Cash needs by client
  const cashNeedsByClient = {}
  for (const cn of raw.plannedCashNeeds) {
    (cashNeedsByClient[cn.client_id] ??= []).push(cn)
  }

  // Commitments by client
  const commitmentsByClient = {}
  for (const cm of raw.commitments) {
    (commitmentsByClient[cm.client_id] ??= []).push(cm)
  }

  // Transactions by portfolio + by client
  const transactionsByPortfolio = {}
  const transactionsByClient = {}
  for (const tx of raw.transactions) {
    (transactionsByPortfolio[tx.portfolio_id] ??= []).push(tx)
    ;(transactionsByClient[tx.client_id] ??= []).push(tx)
  }

  // RM notes by client (flat array)
  const rmNotesByClient = {}
  for (const note of raw.rmNotes) {
    (rmNotesByClient[note.client_id] ??= []).push(note)
  }

  // Market context by snapshot date
  const marketBySnapshot = {}
  for (const m of raw.marketContext) {
    (marketBySnapshot[m.snapshot_date] ??= []).push(m)
  }

  // RM identity (constant across the book per the dictionary).
  const rmSample = raw.clients[0] || {}
  const rm = {
    rm_id: rmSample.rm_id,
    rm_name: rmSample.rm_name,
    rm_desk: rmSample.rm_desk,
  }

  return {
    raw,
    rm,
    clientById,
    portfolioById,
    instrumentById,
    mandateRowsByCode,
    portfoliosByClient,
    holdingsByPortfolioSnapshot,
    creditFacilitiesByClient,
    creditFacilitiesByPortfolio,
    cashNeedsByClient,
    commitmentsByClient,
    transactionsByPortfolio,
    transactionsByClient,
    rmNotesByClient,
    marketBySnapshot,
  }
}

// ─── FX Rates (dataset-supported, from market_context.csv) ──────────────────────
//
// market_context.csv quotes FX pairs in market convention. We expose a helper
// that returns "USD per 1 unit of <ccy>" at a snapshot, derived from the
// available pairs. Holdings already carry market_value_usd, so this is only
// needed for the rare case of converting a raw local amount with no USD field.

export function getUsdRate(ccy, snapshotDate = '2026-08-26') {
  if (!ccy || ccy === 'USD') return 1
  const store = loadAllData()
  const rows = store.marketBySnapshot[snapshotDate] || []
  const find = (id) => {
    const r = rows.find(x => x.series_id === id)
    return r && typeof r.value === 'number' ? r.value : null
  }
  // Pairs present in the dataset are quoted in market convention.
  // USDSGD = SGD per USD  -> USD per SGD = 1/USDSGD
  // EURUSD = USD per EUR  -> USD per EUR = EURUSD
  switch (ccy) {
    case 'SGD': { const v = find('USDSGD'); return v ? 1 / v : null }
    case 'EUR': { const v = find('EURUSD'); return v ?? null }
    case 'HKD': { const v = find('USDHKD'); return v ? 1 / v : null }
    case 'GBP': { const v = find('GBPUSD'); return v ?? null }
    case 'JPY': { const v = find('USDJPY'); return v ? 1 / v : null }
    case 'CHF': { const v = find('USDCHF'); return v ? 1 / v : null }
    default: return null
  }
}

// ─── Validation ────────────────────────────────────────────────────────────────

export function validateData(store) {
  const errors = []
  const warnings = []

  // Portfolio → client + mandate_code
  for (const p of store.raw.portfolios) {
    if (!store.clientById[p.client_id]) errors.push(`Portfolio ${p.portfolio_id} references unknown client ${p.client_id}`)
    // Custody accounts may carry a blank mandate_code — not an error.
    if (p.mandate_code && !store.mandateRowsByCode[p.mandate_code]) {
      warnings.push(`Portfolio ${p.portfolio_id} references mandate_code ${p.mandate_code} not in mandates.csv`)
    }
  }

  // Holdings → portfolio + instrument
  for (const h of store.raw.holdings) {
    if (!store.portfolioById[h.portfolio_id]) { errors.push(`Holding references unknown portfolio ${h.portfolio_id}`); break }
  }
  for (const h of store.raw.holdings) {
    if (!store.instrumentById[h.instrument_id]) { warnings.push(`Holding references instrument ${h.instrument_id} not in instruments.csv`); break }
  }

  // Credit facilities → client + collateral portfolio
  for (const cf of store.raw.creditFacilities) {
    if (!store.clientById[cf.client_id]) errors.push(`Facility ${cf.facility_id} references unknown client ${cf.client_id}`)
    if (cf.collateral_portfolio_id && !store.portfolioById[cf.collateral_portfolio_id]) {
      warnings.push(`Facility ${cf.facility_id} references portfolio ${cf.collateral_portfolio_id} not found`)
    }
  }

  // Cash needs → client
  for (const cn of store.raw.plannedCashNeeds) {
    if (!store.clientById[cn.client_id]) errors.push(`Cash need ${cn.need_id} references unknown client ${cn.client_id}`)
  }

  // Commitments → client
  for (const cm of store.raw.commitments) {
    if (!store.clientById[cm.client_id]) errors.push(`Commitment ${cm.commitment_id} references unknown client ${cm.client_id}`)
  }

  // RM notes → client
  for (const note of store.raw.rmNotes) {
    if (!store.clientById[note.client_id]) warnings.push(`RM note ${note.note_id} references unknown client ${note.client_id}`)
  }

  // Every client has at least one portfolio
  for (const c of store.raw.clients) {
    if (!store.portfoliosByClient[c.client_id]?.length) warnings.push(`Client ${c.client_id} (${c.client_name}) has no portfolios`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      clients: store.raw.clients.length,
      portfolios: store.raw.portfolios.length,
      holdings: store.raw.holdings.length,
      instruments: store.raw.instruments.length,
      mandateRows: store.raw.mandates.length,
      transactions: store.raw.transactions.length,
      creditFacilities: store.raw.creditFacilities.length,
      commitments: store.raw.commitments.length,
      plannedCashNeeds: store.raw.plannedCashNeeds.length,
      marketContextRecords: store.raw.marketContext.length,
      eventLogEntries: store.raw.eventLog.length,
      rmNotes: store.raw.rmNotes.length,
    },
  }
}
