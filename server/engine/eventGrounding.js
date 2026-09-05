/**
 * eventGrounding.js
 *
 * event_log.csv retrieval and AI context injection — OFFICIAL schema.
 *
 * Official event_log.csv columns (16 rows, no id column):
 *   event_date, event_type, region, description, primary_transmission, severity
 * dataLoader synthesises a stable event_id (EVT-001..016 by row order) and
 * marks every row authoritative:true (the official log is THE authority for 2026).
 *
 * GOVERNANCE:
 *   - event_log.csv is authoritative for 2026 events.
 *   - Only events present in the log are injected as AI context.
 *   - If no authoritative event supports a claim, AI must not assert it.
 *   - Every event returned carries its synthesised event_id for traceability.
 */

import { loadAllData } from './dataLoader.js'

// ─── Event Retrieval ───────────────────────────────────────────────────────────

/**
 * Returns all authoritative events from event_log.csv.
 */
export function getAllAuthoritativeEvents() {
  const store = loadAllData()
  return store.raw.eventLog.filter(e => e.authoritative === true).map(formatEvent)
}

/**
 * Returns events relevant to a client. Matching is done on the official fields:
 *   - region                (e.g. "Middle East", "Europe", "Global")
 *   - primary_transmission  (free-text channel, e.g. "Oil price / energy",
 *                             "Rates / duration", "Equity risk sentiment")
 * A caller may pass explicit region/transmission keyword lists; otherwise they
 * are inferred from the client's holdings + profile.
 *
 * @param {string} clientId
 * @param {string[]} regionKeywords
 * @param {string[]} transmissionKeywords
 */
export function getRelevantEvents(clientId, regionKeywords = [], transmissionKeywords = []) {
  const store = loadAllData()
  const client = store.clientById[clientId]
  if (!client) return []

  const regions = regionKeywords.length > 0 ? regionKeywords : inferClientRegions(clientId, store)
  const channels = transmissionKeywords.length > 0 ? transmissionKeywords : inferClientTransmissions(clientId, store)

  const events = store.raw.eventLog.filter(e => {
    if (e.authoritative !== true) return false
    const region = (e.region || '').toLowerCase()
    const transmission = (e.primary_transmission || '').toLowerCase()
    const desc = (e.description || '').toLowerCase()

    const regionMatch = regions.some(r => {
      const rr = r.toLowerCase()
      return region.includes(rr) || rr.includes(region) || desc.includes(rr)
    })
    const channelMatch = channels.some(c => {
      const cc = c.toLowerCase()
      return transmission.includes(cc) || desc.includes(cc)
    })
    // "Global" events touch everyone.
    const isGlobal = region.includes('global')
    return regionMatch || channelMatch || isGlobal
  })

  return events.map(e => ({
    ...formatEvent(e),
    matchedRegions: regions.filter(r => (e.region || '').toLowerCase().includes(r.toLowerCase()) || (e.description || '').toLowerCase().includes(r.toLowerCase())),
    matchedTransmissions: channels.filter(c => (e.primary_transmission || '').toLowerCase().includes(c.toLowerCase()) || (e.description || '').toLowerCase().includes(c.toLowerCase())),
  }))
}

/**
 * Returns events by their synthesised IDs (for direct signal-to-event linking).
 */
export function getEventsByIds(eventIds) {
  const store = loadAllData()
  return (eventIds || [])
    .map(id => store.raw.eventLog.find(e => e.event_id === id))
    .filter(Boolean)
    .filter(e => e.authoritative === true)
    .map(formatEvent)
}

/**
 * Builds the event context block injected into OpenAI prompts.
 * GOVERNANCE: AI may only reference events in this block.
 */
export function buildEventContextForAI(clientId, eventIds = null) {
  let events
  if (eventIds && eventIds.length > 0) {
    events = getEventsByIds(eventIds)
  } else {
    events = getRelevantEvents(clientId)
  }

  if (events.length === 0) {
    return {
      eventCount: 0,
      contextText: 'No authoritative events from event_log.csv are relevant to this client context.',
      events: [],
      eventIds: [],
    }
  }

  const contextText = [
    '=== AUTHORITATIVE 2026 EVENTS (event_log.csv) ===',
    'The following events are the ONLY authoritative market/geopolitical events you may reference.',
    'Do NOT claim any 2026 event occurred unless it appears in this list.',
    '',
    ...events.map(e => [
      `[${e.eventId}] ${e.date} — ${e.title}`,
      `Type: ${e.type} | Region: ${e.region} | Severity: ${e.severity}`,
      `Transmission: ${e.transmission}`,
      `Description: ${e.description}`,
      '',
    ].join('\n')),
    '=== END AUTHORITATIVE EVENTS ===',
  ].join('\n')

  return {
    eventCount: events.length,
    contextText,
    events,
    eventIds: events.map(e => e.eventId),
  }
}

// ─── Inference Helpers ─────────────────────────────────────────────────────────

// Map holding sectors/regions to the transmission channels used in event_log.
const SECTOR_TRANSMISSION_HINTS = [
  { match: /energy|oil|petro|shipping|marine|logistics|industrials/i, channels: ['Oil', 'energy', 'shipping', 'supply', 'Hormuz'] },
  { match: /financ|bank/i, channels: ['Rates', 'credit', 'banking'] },
  { match: /real estate|property/i, channels: ['Rates', 'credit', 'property'] },
  { match: /technology|information technology|semiconductor/i, channels: ['Equity risk', 'technology', 'megacap'] },
  { match: /consumer|luxury/i, channels: ['Equity risk', 'consumer'] },
]

function inferClientTransmissions(clientId, store) {
  const channels = new Set(['Equity risk']) // broad market sentiment touches most books
  const portfolios = store.portfoliosByClient[clientId] || []
  for (const pf of portfolios) {
    const byDate = store.holdingsByPortfolioSnapshot[pf.portfolio_id] || {}
    const rows = byDate['2026-08-26'] || Object.values(byDate).flat()
    for (const h of rows) {
      const sectorStr = `${h.sector || ''} ${h.sub_asset_class || ''} ${h.instrument_name || ''}`
      for (const hint of SECTOR_TRANSMISSION_HINTS) {
        if (hint.match.test(sectorStr)) hint.channels.forEach(c => channels.add(c))
      }
    }
  }
  return Array.from(channels)
}

function inferClientRegions(clientId, store) {
  const regions = new Set()
  const client = store.clientById[clientId]
  if (client?.base_currency === 'EUR') regions.add('Europe')
  if (client?.base_currency === 'HKD') { regions.add('Asia'); regions.add('Greater China') }
  if (client?.base_currency === 'USD') regions.add('Global')

  const portfolios = store.portfoliosByClient[clientId] || []
  for (const pf of portfolios) {
    const byDate = store.holdingsByPortfolioSnapshot[pf.portfolio_id] || {}
    const rows = byDate['2026-08-26'] || Object.values(byDate).flat()
    for (const h of rows) {
      if (h.region) regions.add(h.region)
    }
  }
  return Array.from(regions)
}

function formatEvent(e) {
  return {
    eventId: e.event_id,
    date: e.event_date,
    title: e.description ? e.description.split('.')[0] : e.event_type,
    type: e.event_type,
    region: e.region,
    transmission: e.primary_transmission,
    severity: e.severity,
    description: e.description,
    authoritative: true,
    source: 'event_log.csv',
  }
}
