/**
 * dataLoader.js
 *
 * Loads all official WealthLens CSV and JSON datasets from server/data/.
 * Provides parsed, validated, normalised records.
 *
 * GOVERNANCE:
 *   - event_log.csv is authoritative for 2026 geopolitical/market events.
 *   - No financial calculations are performed here — this is data loading only.
 *   - All monetary values are stored as numbers in their original currency;
 *     CHF equivalents are pre-computed in the dataset files.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../data')

// ─── CSV Parser ────────────────────────────────────────────────────────────────

/**
 * Minimal, robust CSV parser. Handles quoted fields and empty values.
 * Returns array of objects keyed by header row.
 */
function parseCSV(raw) {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const headers = splitCSVLine(lines[0])
  const records = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = splitCSVLine(line)
    const record = {}
    headers.forEach((h, idx) => {
      const raw = values[idx] ?? ''
      record[h.trim()] = raw.trim()
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
  const path = join(DATA_DIR, filename)
  const raw = readFileSync(path, 'utf-8')
  return parseCSV(raw)
}

function loadJSON(filename) {
  const path = join(DATA_DIR, filename)
  return JSON.parse(readFileSync(path, 'utf-8'))
}

// ─── Type Coercion ─────────────────────────────────────────────────────────────

const NUMERIC_FIELDS = new Set([
  'aum_chf', 'equity_min_pct', 'equity_max_pct', 'fixed_income_min_pct',
  'fixed_income_max_pct', 'cash_min_pct', 'cash_max_pct', 'alternatives_min_pct',
  'alternatives_max_pct', 'max_single_issuer_pct', 'max_single_sector_pct',
  'quantity', 'market_value_local', 'market_value_chf', 'weight_pct',
  'acquisition_price_local', 'cost_basis_chf', 'unrealised_pnl_chf',
  'coupon_rate', 'limit_amount', 'drawn_amount', 'available_amount',
  'interest_rate_pct', 'collateral_value', 'ltv_current_pct',
  'ltv_threshold_pct', 'ltv_margin_call_pct', 'margin_call_proximity_pct',
  'amount_local', 'amount_chf', 'total_committed_amount', 'amount_called',
  'amount_remaining', 'metric_value', 'gross_amount_local', 'gross_amount_chf',
  'price_local', 'contact_cadence_days', 'relationship_since',
])

function coerce(records) {
  return records.map(r => {
    const out = { ...r }
    for (const key of Object.keys(out)) {
      if (NUMERIC_FIELDS.has(key) && out[key] !== '' && out[key] !== null) {
        const n = Number(out[key])
        if (!isNaN(n)) out[key] = n
      }
      // Boolean coercion
      if (out[key] === 'Y') out[key] = true
      if (out[key] === 'N') out[key] = false
    }
    return out
  })
}

// ─── Load All Datasets ─────────────────────────────────────────────────────────

let _cache = null

export function loadAllData() {
  if (_cache) return _cache

  const raw = {
    clients:           coerce(loadCSV('clients.csv')),
    portfolios:        coerce(loadCSV('portfolios.csv')),
    holdings:          coerce(loadCSV('holdings.csv')),
    holdingsSnapshots: coerce(loadCSV('holdings_snapshots.csv')),
    instruments:       coerce(loadCSV('instruments.csv')),
    mandates:          coerce(loadCSV('mandates.csv')),
    transactions:      coerce(loadCSV('transactions.csv')),
    creditFacilities:  coerce(loadCSV('credit_facilities.csv')),
    commitments:       coerce(loadCSV('commitments.csv')),
    plannedCashNeeds:  coerce(loadCSV('planned_cash_needs.csv')),
    marketContext:     coerce(loadCSV('market_context.csv')),
    eventLog:          coerce(loadCSV('event_log.csv')),
    rmNotes:           loadJSON('rm_notes.json'),
  }

  _cache = buildNormalisedStore(raw)
  return _cache
}

// ─── Normalised Store ──────────────────────────────────────────────────────────

function buildNormalisedStore(raw) {
  // Index maps for O(1) lookup
  const clientById = Object.fromEntries(raw.clients.map(c => [c.client_id, c]))
  const portfolioById = Object.fromEntries(raw.portfolios.map(p => [p.portfolio_id, p]))
  const instrumentById = Object.fromEntries(raw.instruments.map(i => [i.instrument_id, i]))
  const mandateById = Object.fromEntries(raw.mandates.map(m => [m.mandate_id, m]))

  // Client → portfolios
  const portfoliosByClient = {}
  for (const p of raw.portfolios) {
    if (!portfoliosByClient[p.client_id]) portfoliosByClient[p.client_id] = []
    portfoliosByClient[p.client_id].push(p)
  }

  // Portfolio → holdings (latest snapshot: 2026-08-26)
  const holdingsByPortfolio = {}
  for (const h of raw.holdings) {
    if (!holdingsByPortfolio[h.portfolio_id]) holdingsByPortfolio[h.portfolio_id] = []
    holdingsByPortfolio[h.portfolio_id].push(h)
  }

  // Snapshot holdings: portfolio_id → snapshot_date → holdings
  const snapshotHoldingsByPortfolio = {}
  for (const h of raw.holdingsSnapshots) {
    if (!snapshotHoldingsByPortfolio[h.portfolio_id]) snapshotHoldingsByPortfolio[h.portfolio_id] = {}
    if (!snapshotHoldingsByPortfolio[h.portfolio_id][h.snapshot_date])
      snapshotHoldingsByPortfolio[h.portfolio_id][h.snapshot_date] = []
    snapshotHoldingsByPortfolio[h.portfolio_id][h.snapshot_date].push(h)
  }

  // Credit facilities by client
  const creditFacilitiesByClient = {}
  for (const cf of raw.creditFacilities) {
    if (!creditFacilitiesByClient[cf.client_id]) creditFacilitiesByClient[cf.client_id] = []
    creditFacilitiesByClient[cf.client_id].push(cf)
  }

  // Cash needs by client
  const cashNeedsByClient = {}
  for (const cn of raw.plannedCashNeeds) {
    if (!cashNeedsByClient[cn.client_id]) cashNeedsByClient[cn.client_id] = []
    cashNeedsByClient[cn.client_id].push(cn)
  }

  // Commitments by client
  const commitmentsByClient = {}
  for (const cm of raw.commitments) {
    if (!commitmentsByClient[cm.client_id]) commitmentsByClient[cm.client_id] = []
    commitmentsByClient[cm.client_id].push(cm)
  }

  // Transactions by portfolio
  const transactionsByPortfolio = {}
  for (const tx of raw.transactions) {
    if (!transactionsByPortfolio[tx.portfolio_id]) transactionsByPortfolio[tx.portfolio_id] = []
    transactionsByPortfolio[tx.portfolio_id].push(tx)
  }

  // RM Notes by client (from JSON)
  const rmNotesByClient = {}
  for (const note of raw.rmNotes.notes) {
    if (!rmNotesByClient[note.client_id]) rmNotesByClient[note.client_id] = []
    rmNotesByClient[note.client_id].push(note)
  }

  // Market context by snapshot date
  const marketBySnapshot = {}
  for (const m of raw.marketContext) {
    if (!marketBySnapshot[m.snapshot_date]) marketBySnapshot[m.snapshot_date] = []
    marketBySnapshot[m.snapshot_date].push(m)
  }

  // Mandate by client
  const mandateByClient = Object.fromEntries(raw.mandates.map(m => [m.client_id, m]))

  return {
    // Raw arrays
    raw,
    // RM metadata
    rm: raw.rmNotes,
    // Indexed lookups
    clientById,
    portfolioById,
    instrumentById,
    mandateById,
    mandateByClient,
    // Relational indexes
    portfoliosByClient,
    holdingsByPortfolio,
    snapshotHoldingsByPortfolio,
    creditFacilitiesByClient,
    cashNeedsByClient,
    commitmentsByClient,
    transactionsByPortfolio,
    rmNotesByClient,
    marketBySnapshot,
  }
}

// ─── Validation ────────────────────────────────────────────────────────────────

/**
 * Runs referential integrity checks across the dataset.
 * Returns { valid: bool, errors: string[], warnings: string[] }
 */
export function validateData(store) {
  const errors = []
  const warnings = []

  // 1. Portfolio → client relationship
  for (const p of store.raw.portfolios) {
    if (!store.clientById[p.client_id]) {
      errors.push(`Portfolio ${p.portfolio_id} references unknown client ${p.client_id}`)
    }
    if (!store.mandateById[p.mandate_id]) {
      errors.push(`Portfolio ${p.portfolio_id} references unknown mandate ${p.mandate_id}`)
    }
  }

  // 2. Holdings → portfolio and instrument
  for (const h of store.raw.holdings) {
    if (!store.portfolioById[h.portfolio_id]) {
      errors.push(`Holding ${h.holding_id} references unknown portfolio ${h.portfolio_id}`)
    }
    if (!store.instrumentById[h.instrument_id]) {
      errors.push(`Holding ${h.holding_id} references unknown instrument ${h.instrument_id}`)
    }
  }

  // 3. Snapshot holdings → portfolio and instrument
  for (const h of store.raw.holdingsSnapshots) {
    if (!store.portfolioById[h.portfolio_id]) {
      warnings.push(`Snapshot holding ${h.holding_id} references unknown portfolio ${h.portfolio_id}`)
    }
    if (!store.instrumentById[h.instrument_id]) {
      warnings.push(`Snapshot holding ${h.holding_id} references unknown instrument ${h.instrument_id}`)
    }
  }

  // 4. Credit facilities → client and portfolio
  for (const cf of store.raw.creditFacilities) {
    if (!store.clientById[cf.client_id]) {
      errors.push(`Credit facility ${cf.facility_id} references unknown client ${cf.client_id}`)
    }
    if (!store.portfolioById[cf.portfolio_id]) {
      warnings.push(`Credit facility ${cf.facility_id} references portfolio ${cf.portfolio_id} not found`)
    }
  }

  // 5. Planned cash needs → client
  for (const cn of store.raw.plannedCashNeeds) {
    if (!store.clientById[cn.client_id]) {
      errors.push(`Cash need ${cn.need_id} references unknown client ${cn.client_id}`)
    }
  }

  // 6. Commitments → client, portfolio, instrument
  for (const cm of store.raw.commitments) {
    if (!store.clientById[cm.client_id]) {
      errors.push(`Commitment ${cm.commitment_id} references unknown client ${cm.client_id}`)
    }
    if (!store.instrumentById[cm.instrument_id]) {
      warnings.push(`Commitment ${cm.commitment_id} references instrument ${cm.instrument_id} not found`)
    }
  }

  // 7. Mandate → client
  for (const m of store.raw.mandates) {
    if (!store.clientById[m.client_id]) {
      errors.push(`Mandate ${m.mandate_id} references unknown client ${m.client_id}`)
    }
  }

  // 8. RM notes → client
  for (const note of store.raw.rmNotes.notes) {
    if (!store.clientById[note.client_id]) {
      warnings.push(`RM note ${note.note_id} references unknown client ${note.client_id}`)
    }
  }

  // 9. All 20 clients have portfolios
  for (const c of store.raw.clients) {
    if (!store.portfoliosByClient[c.client_id] || store.portfoliosByClient[c.client_id].length === 0) {
      warnings.push(`Client ${c.client_id} (${c.full_name}) has no portfolios`)
    }
  }

  // 10. Primary clients have RM notes
  for (const id of ['CL-0014', 'CL-0019', 'CL-0003']) {
    if (!store.rmNotesByClient[id] || store.rmNotesByClient[id].length === 0) {
      warnings.push(`Primary client ${id} has no RM notes`)
    }
  }

  // 11. event_log authoritative flag check
  const nonAuthoritative = store.raw.eventLog.filter(e => e.authoritative !== true)
  if (nonAuthoritative.length > 0) {
    warnings.push(`${nonAuthoritative.length} event_log entries are not marked authoritative`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      clients: store.raw.clients.length,
      portfolios: store.raw.portfolios.length,
      holdings: store.raw.holdings.length,
      holdingsSnapshots: store.raw.holdingsSnapshots.length,
      instruments: store.raw.instruments.length,
      mandates: store.raw.mandates.length,
      transactions: store.raw.transactions.length,
      creditFacilities: store.raw.creditFacilities.length,
      commitments: store.raw.commitments.length,
      plannedCashNeeds: store.raw.plannedCashNeeds.length,
      marketContextRecords: store.raw.marketContext.length,
      eventLogEntries: store.raw.eventLog.length,
      rmNotes: store.raw.rmNotes.notes.length,
    }
  }
}
