// Data access layer.
//
// This is the single seam between the UI and its data source. Today it returns
// mock data synchronously wrapped in Promises. To move to a real REST API,
// replace the bodies of these functions with fetch() calls to your endpoints,
// keeping the same signatures and return shapes. The UI never imports the mock
// files directly, so nothing else needs to change.

import { relationshipManager } from '../data/rm.js'
import { clients } from '../data/clients.js'
import { portfolios } from '../data/portfolios.js'
import { intelligenceSignals } from '../data/intelligence.js'
import { briefings } from '../data/briefings.js'
import { marketSnapshot, marketNarratives } from '../data/market.js'

// Simulate latency so loading states are realistic. Set to 0 to disable.
const LATENCY_MS = 0

const resolve = (value) =>
  new Promise((res) => {
    if (LATENCY_MS > 0) setTimeout(() => res(value), LATENCY_MS)
    else res(value)
  })

const clone = (value) => JSON.parse(JSON.stringify(value))

// --- Relationship Manager ---
export const getRelationshipManager = () => resolve(clone(relationshipManager))

// --- Clients ---
export const getClients = () => resolve(clone(clients))

export const getClientById = (id) =>
  resolve(clone(clients.find((c) => c.id === id) || null))

// --- Portfolios ---
export const getPortfolio = (clientId) =>
  resolve(clone(portfolios[clientId] || null))

export const getAllPortfolios = () => resolve(clone(portfolios))

// --- Intelligence ---
export const getIntelligence = () => resolve(clone(intelligenceSignals))

export const getIntelligenceForClient = (clientId) =>
  resolve(clone(intelligenceSignals.filter((s) => s.clientId === clientId)))

// --- Briefings ---
export const getBriefings = () => resolve(clone(briefings))

export const getBriefingById = (id) =>
  resolve(clone(briefings.find((b) => b.id === id) || null))

// --- Market ---
export const getMarketSnapshot = () => resolve(clone(marketSnapshot))
export const getMarketNarratives = () => resolve(clone(marketNarratives))
