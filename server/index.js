/**
 * WealthLens API Server
 *
 * Exposes all data, intelligence, and AI endpoints.
 * OPENAI_API_KEY is server-side only — never returned to the browser.
 *
 * Endpoint summary:
 *   GET  /api/health
 *   GET  /api/validate                    — dataset validation report
 *   GET  /api/clients                     — all 20 clients
 *   GET  /api/clients/:id                 — single client
 *   GET  /api/clients/:id/portfolio       — portfolio at latest snapshot
 *   GET  /api/clients/:id/intelligence    — full intelligence object
 *   GET  /api/clients/:id/snapshots       — snapshot history
 *   GET  /api/intelligence/priority       — all clients prioritised
 *   GET  /api/events                      — all authoritative events
 *   GET  /api/events/:id                  — single event
 *   GET  /api/rm                          — RM profile
 *   POST /api/ai/brief                    — generate AI brief (structured input)
 *   POST /api/ai/brief/legacy             — legacy text brief endpoint
 *   GET  /api/briefs                      — all briefs
 *   GET  /api/briefs/:id                  — single brief
 *   POST /api/briefs                      — create brief
 *   PATCH /api/briefs/:id/approve         — approve brief
 *   PATCH /api/briefs/:id/reject          — reject brief
 *   PATCH /api/briefs/:id/edit            — edit brief
 *   GET  /api/market/:snapshot            — market context at snapshot
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { pathToFileURL } from 'url'

// Engine imports
import { loadAllData, validateData } from './engine/dataLoader.js'
import { getClientIntelligence } from './engine/intelligenceEngine.js'
import { scoreAllClients } from './engine/priorityEngine.js'
import {
  getClientAggregatedPortfolio,
  getSnapshotHistory,
  compareSnapshots,
  LATEST_SNAPSHOT,
  SNAPSHOTS,
} from './engine/snapshotEngine.js'
import {
  getAllAuthoritativeEvents,
  getRelevantEvents,
  getEventsByIds,
} from './engine/eventGrounding.js'

// Service imports
import { generateRMBrief, generateRMBriefLegacy } from './services/openaiService.js'
import {
  createBrief,
  getBrief,
  getBriefsForClient,
  getAllBriefs,
  approveBrief,
  rejectBrief,
  editBrief,
  getActiveBriefContent,
  getBriefsByStatus,
} from './services/briefWorkflow.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// ─── Error Helper ──────────────────────────────────────────────────────────────

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// ─── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WealthLens API',
    version: '2.0.0',
    snapshots: SNAPSHOTS,
    latestSnapshot: LATEST_SNAPSHOT,
  })
})

// ─── Dataset Validation ────────────────────────────────────────────────────────

app.get('/api/validate', asyncHandler(async (req, res) => {
  const store = loadAllData()
  const result = validateData(store)
  res.json(result)
}))

// ─── RM Profile ────────────────────────────────────────────────────────────────

app.get('/api/rm', asyncHandler(async (req, res) => {
  const store = loadAllData()
  const rm = store.rm
  res.json({
    rmId: rm.rm_id,
    name: rm.rm_name,
    desk: rm.rm_desk,
  })
}))

// ─── Clients ───────────────────────────────────────────────────────────────────

app.get('/api/clients', asyncHandler(async (req, res) => {
  const store = loadAllData()
  const clients = store.raw.clients.map(c => ({
    clientId: c.client_id,
    name: c.client_name,
    age: c.age,
    baseCurrency: c.base_currency,
    riskProfile: c.risk_profile,
    wealthBand: c.wealth_band,
    aumUsd: c.total_aum_usd,
    lifeStage: c.life_stage,
    sourceOfWealth: c.source_of_wealth,
    liquidityNeeds: c.liquidity_needs,
    clientSince: c.client_since,
  }))
  res.json(clients)
}))

app.get('/api/clients/:id', asyncHandler(async (req, res) => {
  const store = loadAllData()
  const client = store.clientById[req.params.id]
  if (!client) return res.status(404).json({ error: 'Client not found' })
  // Join mandate rows for each of the client's portfolios (mandate_code → rows).
  const portfolios = store.portfoliosByClient[req.params.id] || []
  const mandates = portfolios.map(p => ({
    portfolioId: p.portfolio_id,
    mandateCode: p.mandate_code,
    mandateName: p.mandate_name,
    rows: store.mandateRowsByCode[p.mandate_code] || [],
  }))
  res.json({ ...client, mandates })
}))

// ─── Portfolio ─────────────────────────────────────────────────────────────────

app.get('/api/clients/:id/portfolio', asyncHandler(async (req, res) => {
  const { snapshot = LATEST_SNAPSHOT } = req.query
  if (!SNAPSHOTS.includes(snapshot)) {
    return res.status(400).json({ error: `Invalid snapshot. Valid: ${SNAPSHOTS.join(', ')}` })
  }
  const portfolio = getClientAggregatedPortfolio(req.params.id, snapshot)
  res.json(portfolio)
}))

app.get('/api/clients/:id/snapshots', asyncHandler(async (req, res) => {
  const history = getSnapshotHistory(req.params.id)
  res.json({ clientId: req.params.id, snapshots: SNAPSHOTS, history })
}))

app.get('/api/clients/:id/snapshots/compare', asyncHandler(async (req, res) => {
  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from and to snapshot dates required' })
  const comparison = compareSnapshots(req.params.id, from, to)
  res.json(comparison)
}))

// ─── Intelligence ──────────────────────────────────────────────────────────────

app.get('/api/clients/:id/intelligence', asyncHandler(async (req, res) => {
  const { snapshot = LATEST_SNAPSHOT } = req.query
  const intel = getClientIntelligence(req.params.id, snapshot)
  if (!intel) return res.status(404).json({ error: 'Client not found' })
  res.json(intel)
}))

app.get('/api/intelligence/priority', asyncHandler(async (req, res) => {
  const { snapshot = LATEST_SNAPSHOT } = req.query
  const priority = scoreAllClients(snapshot)
  res.json(priority)
}))

// ─── Events ────────────────────────────────────────────────────────────────────

app.get('/api/events', asyncHandler(async (req, res) => {
  const { sector, region } = req.query
  let events

  if (sector || region) {
    const sectors = sector ? sector.split(',') : []
    const regions = region ? region.split(',') : []
    events = getRelevantEvents(null, sectors, regions)
  } else {
    events = getAllAuthoritativeEvents()
  }

  res.json({ count: events.length, events })
}))

app.get('/api/events/:id', asyncHandler(async (req, res) => {
  const events = getEventsByIds([req.params.id])
  if (!events.length) return res.status(404).json({ error: 'Event not found' })
  res.json(events[0])
}))

// ─── Market Context ────────────────────────────────────────────────────────────

app.get('/api/market/:snapshot', asyncHandler(async (req, res) => {
  const store = loadAllData()
  const { snapshot } = req.params
  if (!SNAPSHOTS.includes(snapshot)) {
    return res.status(400).json({ error: `Invalid snapshot. Valid: ${SNAPSHOTS.join(', ')}` })
  }
  const context = store.marketBySnapshot[snapshot] || []
  res.json({ snapshot, count: context.length, data: context })
}))

// ─── AI Brief ─────────────────────────────────────────────────────────────────

// Structured brief generation — receives aiBriefInput from intelligenceEngine
app.post('/api/ai/brief/structured', asyncHandler(async (req, res) => {
  const { briefInput } = req.body
  if (!briefInput) return res.status(400).json({ error: 'briefInput is required' })

  // generateRMBrief always resolves: OpenAI when available, deterministic
  // (verified-data-only) fallback otherwise. No 503 — the feature always works.
  const aiBrief = await generateRMBrief(briefInput)
  res.json({ brief: aiBrief })
}))

// Generate and save brief for a client in one step
app.post('/api/clients/:id/brief', asyncHandler(async (req, res) => {
  const { snapshot = LATEST_SNAPSHOT } = req.query
  const intel = getClientIntelligence(req.params.id, snapshot)
  if (!intel) return res.status(404).json({ error: 'Client not found' })
  if (!intel.aiBriefInput) {
    return res.status(400).json({ error: 'Deep intelligence not available for this client' })
  }

  // OpenAI when available; deterministic fallback otherwise.
  const aiBrief = await generateRMBrief(intel.aiBriefInput)

  const brief = createBrief({
    clientId: req.params.id,
    clientName: intel.clientName,
    aiBrief,
    aiBriefInput: intel.aiBriefInput,
    signals: intel.signals,
  })

  res.json({ brief })
}))

// Legacy endpoint — backward compatible
app.post('/api/ai/brief', asyncHandler(async (req, res) => {
  const { input } = req.body
  if (!input) return res.status(400).json({ error: 'Input is required.' })
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OpenAI API key not configured' })

  const brief = await generateRMBriefLegacy(input)
  res.json({ brief })
}))

// ─── Brief Workflow ────────────────────────────────────────────────────────────

app.get('/api/briefs', asyncHandler(async (req, res) => {
  const { status, clientId } = req.query
  let briefs

  if (clientId) {
    briefs = getBriefsForClient(clientId)
  } else if (status) {
    briefs = getBriefsByStatus(status)
  } else {
    briefs = getAllBriefs()
  }

  res.json({ count: briefs.length, briefs })
}))

app.get('/api/briefs/:id', asyncHandler(async (req, res) => {
  const brief = getBrief(req.params.id)
  if (!brief) return res.status(404).json({ error: 'Brief not found' })
  res.json(brief)
}))

app.get('/api/briefs/:id/content', asyncHandler(async (req, res) => {
  const content = getActiveBriefContent(req.params.id)
  if (!content) return res.status(404).json({ error: 'Brief not found or rejected' })
  res.json(content)
}))

app.post('/api/briefs', asyncHandler(async (req, res) => {
  const { clientId, clientName, aiBrief, aiBriefInput, signals } = req.body
  if (!clientId || !aiBrief) return res.status(400).json({ error: 'clientId and aiBrief required' })

  const brief = createBrief({ clientId, clientName, aiBrief, aiBriefInput, signals })
  res.status(201).json(brief)
}))

app.patch('/api/briefs/:id/approve', asyncHandler(async (req, res) => {
  const { rmId } = req.body
  const brief = approveBrief(req.params.id, rmId)
  res.json(brief)
}))

app.patch('/api/briefs/:id/reject', asyncHandler(async (req, res) => {
  const { rmId, reason } = req.body
  const brief = rejectBrief(req.params.id, rmId, reason)
  res.json(brief)
}))

app.patch('/api/briefs/:id/edit', asyncHandler(async (req, res) => {
  const { editedContent, rmId } = req.body
  if (!editedContent) return res.status(400).json({ error: 'editedContent required' })
  const brief = editBrief(req.params.id, editedContent, rmId)
  res.json(brief)
}))

// ─── Error Handler ─────────────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('[WealthLens API Error]', err.message)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

// ─── Start ─────────────────────────────────────────────────────────────────────

// The Express app is exported so it can run in two ways:
//   1. Local development / standalone: `node server/index.js` calls app.listen.
//   2. Vercel serverless: api/index.js imports this app and hands it to the
//      serverless runtime (no app.listen — Vercel manages the HTTP lifecycle).
//
// We only bind a port when this file is the process entry point, detected by
// comparing the resolved module URL to the invoked script path.
function startLocalServer() {
  app.listen(PORT, () => {
    console.log(`WealthLens API running on http://localhost:${PORT}`)
    console.log(`Data validation:`)

    try {
      const store = loadAllData()
      const validation = validateData(store)
      console.log(`  Clients: ${validation.summary.clients}`)
      console.log(`  Portfolios: ${validation.summary.portfolios}`)
      console.log(`  Holdings: ${validation.summary.holdings}`)
      console.log(`  Instruments: ${validation.summary.instruments}`)
      console.log(`  Credit facilities: ${validation.summary.creditFacilities}`)
      console.log(`  Planned cash needs: ${validation.summary.plannedCashNeeds}`)
      console.log(`  Event log entries: ${validation.summary.eventLogEntries}`)
      console.log(`  RM notes: ${validation.summary.rmNotes}`)
      console.log(`  Valid: ${validation.valid}`)
      if (validation.errors.length > 0) {
        console.warn(`  Errors: ${validation.errors.join('; ')}`)
      }
      if (validation.warnings.length > 0) {
        console.warn(`  Warnings (${validation.warnings.length}): ${validation.warnings.slice(0, 3).join('; ')}${validation.warnings.length > 3 ? '...' : ''}`)
      }
    } catch (e) {
      console.error('  Failed to load data:', e.message)
    }
  })
}

// Detect "run directly" in an ESM context. On Vercel the app is imported, so
// this is false and no port is bound.
const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  startLocalServer()
}

// Default export for the Vercel serverless entry (api/index.js).
export default app
