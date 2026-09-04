/**
 * eventGrounding.js
 *
 * Phase 7: event_log.csv retrieval and AI context injection.
 *
 * GOVERNANCE:
 *   - event_log.csv is authoritative for 2026 events.
 *   - Only events with authoritative=true are injected as AI context.
 *   - If no authoritative event supports a claim, AI must not assert it.
 *   - All events returned include their event_id for traceability.
 */

import { loadAllData } from './dataLoader.js'

// ─── Event Retrieval ───────────────────────────────────────────────────────────

/**
 * Returns all authoritative events from event_log.csv.
 */
export function getAllAuthoritativeEvents() {
  const store = loadAllData()
  return store.raw.eventLog
    .filter(e => e.authoritative === true)
    .map(formatEvent)
}

/**
 * Returns events relevant to a given client based on their portfolio sector exposures
 * and geographic focus.
 *
 * @param {string} clientId
 * @param {string[]} sectors - e.g. ['Real Estate', 'Shipping', 'Technology']
 * @param {string[]} regions - e.g. ['Hong Kong', 'UAE', 'Europe']
 * @returns {Array} Matched authoritative events with relevance explanation
 */
export function getRelevantEvents(clientId, sectors = [], regions = []) {
  const store = loadAllData()

  const client = store.clientById[clientId]
  if (!client) return []

  // Build sector and region sets from client context if not provided
  const effectiveSectors = sectors.length > 0 ? sectors : inferClientSectors(clientId, store)
  const effectiveRegions = regions.length > 0 ? regions : inferClientRegions(clientId, store)

  const events = store.raw.eventLog.filter(e => {
    if (e.authoritative !== true) return false

    const affectedSectors = (e.affected_sectors || '').split(';').map(s => s.trim())
    const affectedRegions = (e.affected_regions || '').split(';').map(r => r.trim())

    const sectorMatch = effectiveSectors.some(s =>
      affectedSectors.some(as => as.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(as.toLowerCase()))
    )
    const regionMatch = effectiveRegions.some(r =>
      affectedRegions.some(ar => ar.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(ar.toLowerCase()))
    )

    return sectorMatch || regionMatch
  })

  return events.map(e => ({
    ...formatEvent(e),
    matchedSectors: (e.affected_sectors || '').split(';').filter(s =>
      effectiveSectors.some(es => es.toLowerCase().includes(s.trim().toLowerCase()) || s.trim().toLowerCase().includes(es.toLowerCase()))
    ),
    matchedRegions: (e.affected_regions || '').split(';').filter(r =>
      effectiveRegions.some(er => er.toLowerCase().includes(r.trim().toLowerCase()) || r.trim().toLowerCase().includes(er.toLowerCase()))
    ),
  }))
}

/**
 * Returns events by their IDs (for direct signal-to-event linking).
 */
export function getEventsByIds(eventIds) {
  const store = loadAllData()
  return eventIds
    .map(id => store.raw.eventLog.find(e => e.event_id === id))
    .filter(Boolean)
    .filter(e => e.authoritative === true)
    .map(formatEvent)
}

/**
 * Builds the event context block to inject into OpenAI prompts.
 * Returns a structured text block that the AI system prompt references.
 *
 * GOVERNANCE: AI must only reference events in this block. If not here, it didn't happen.
 */
export function buildEventContextForAI(clientId, eventIds = null) {
  const store = loadAllData()
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
    }
  }

  const contextText = [
    '=== AUTHORITATIVE 2026 EVENTS (event_log.csv) ===',
    'The following events are the ONLY authoritative market/geopolitical events you may reference.',
    'Do NOT claim any 2026 event occurred unless it appears in this list.',
    '',
    ...events.map(e => [
      `[${e.eventId}] ${e.date} — ${e.title}`,
      `Type: ${e.type} | Severity: ${e.severity}`,
      `Description: ${e.description}`,
      `Market Impact: ${e.marketImpact}`,
      `Source: ${e.sourceReference}`,
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

function inferClientSectors(clientId, store) {
  const portfolios = store.portfoliosByClient[clientId] || []
  const sectors = new Set()

  for (const pf of portfolios) {
    const holdings = store.holdingsByPortfolio[pf.portfolio_id] || []
    for (const h of holdings) {
      const inst = store.instrumentById[h.instrument_id]
      if (inst?.sector) {
        inst.sector.split('/').forEach(s => sectors.add(s.trim()))
      }
    }
  }

  // Also add client's source of wealth sector
  const client = store.clientById[clientId]
  if (client?.business_sector) {
    client.business_sector.split('/').forEach(s => sectors.add(s.trim()))
  }

  return Array.from(sectors)
}

function inferClientRegions(clientId, store) {
  const client = store.clientById[clientId]
  const regions = new Set()

  if (client?.domicile_country) regions.add(client.domicile_country)
  if (client?.domicile_city) regions.add(client.domicile_city)

  // Portfolio instrument geographies
  const portfolios = store.portfoliosByClient[clientId] || []
  for (const pf of portfolios) {
    const holdings = store.holdingsByPortfolio[pf.portfolio_id] || []
    for (const h of holdings) {
      const inst = store.instrumentById[h.instrument_id]
      if (inst?.geography) regions.add(inst.geography)
    }
  }

  return Array.from(regions)
}

function formatEvent(e) {
  return {
    eventId: e.event_id,
    date: e.event_date,
    title: e.event_title,
    type: e.event_type,
    affectedRegions: (e.affected_regions || '').split(';').map(s => s.trim()),
    affectedSectors: (e.affected_sectors || '').split(';').map(s => s.trim()),
    severity: e.severity,
    description: e.description,
    marketImpact: e.market_impact_note,
    sourceReference: e.source_reference,
    authoritative: true,
  }
}
