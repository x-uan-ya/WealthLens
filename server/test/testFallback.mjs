/**
 * testFallback.mjs
 *
 * Validates fallback mode by explicitly clearing OPENAI_API_KEY before
 * importing any server modules. Run with:
 *   node server/test/testFallback.mjs
 */

// ── 1. Wipe the key before any imports ──────────────────────────────────────
delete process.env.OPENAI_API_KEY
process.env.PORT = '3099'   // use a separate port so it does not clash

// ── 2. Import modules that used to crash at load time ────────────────────────
import { isOpenAIAvailable, generateRMBrief, generateRMBriefLegacy } from '../services/openaiService.js'

console.log('\n=== Fallback mode test (no OPENAI_API_KEY) ===')
console.log('isOpenAIAvailable():', isOpenAIAvailable())
if (isOpenAIAvailable()) {
  console.error('FAIL — expected false when key is absent')
  process.exit(1)
}
console.log('✓  isOpenAIAvailable() correctly returns false')

// ── 3. generateRMBrief must return a fallback object, not throw ──────────────
const mockInput = {
  clientContext: {
    clientId: 'CL-0014',
    clientName: 'Lau Chi Ming',
    riskProfile: 'Balanced',
    mandateType: 'Advisory',
    investmentObjective: 'Capital Preservation + Liquidity',
  },
  verifiedMetrics: {
    totalPortfolioChf: 41261400,
    propertyConcentrationPct: 50.9,
    cashNeedChf: 7200000,
    cashNeedDueDate: '2026-11-30',
  },
  signals: [
    { id: 'LAU-SIG-001', type: 'concentration', severity: 'medium', title: 'Property concentration 50.9%', summary: 'High property exposure.' },
    { id: 'LAU-SIG-002', type: 'liquidity',     severity: 'medium', title: 'HKD 60m cash need Nov 2026',  summary: 'Property settlement due.' },
    { id: 'LAU-SIG-003', type: 'credit',        severity: 'high',   title: 'CF-0014-003 near margin call', summary: '77.42% LTV vs 85% threshold.', verifiedMetrics: { ltvCurrentPct: 77.42, ltvMarginCallPct: 85 } },
  ],
  evidence: [
    { claim: 'Property concentration', value: '50.9%', source: 'holdings.csv', recordId: 'H-PF14A-001', snapshot: '2026-08-26' },
  ],
  rmNotes: [
    { noteId: 'RMN-0014-001', date: '2026-07-15', subject: 'Kowloon settlement confirmed', actionRequired: true },
  ],
  authoritativeEvents: [
    { eventId: 'EVT-2026-010', date: '2026-06-18', title: 'China Housing Policy Package' },
  ],
  authoritativeEventContextText: '=== AUTHORITATIVE EVENTS ===\n[EVT-2026-010] 2026-06-18 — China Housing Policy Package',
  uncertainties: ['LTV depends on collateral valuation which can move quickly.'],
}

let brief
try {
  brief = await generateRMBrief(mockInput)
} catch (err) {
  console.error('FAIL — generateRMBrief threw instead of returning fallback:', err.message)
  process.exit(1)
}

console.log('\n✓  generateRMBrief() returned without throwing')
console.log('  _fallback:', brief._fallback)
console.log('  model:', brief._metadata?.model)

if (brief._fallback !== true) {
  console.error('FAIL — expected _fallback: true')
  process.exit(1)
}
console.log('✓  _fallback: true confirmed')

// Check required fields
for (const field of ['summary', 'whyItMatters', 'discussionPoints', 'uncertainties', 'evidenceReferences', 'clientFriendlySummary', 'rmPreparationNotes']) {
  if (!brief[field]) {
    console.error(`FAIL — missing field: ${field}`)
    process.exit(1)
  }
}
console.log('✓  All required brief fields present')
console.log('  summary:', brief.summary.slice(0, 100))
console.log('  discussionPoints:', brief.discussionPoints.length, 'items')
console.log('  evidenceReferences:', brief.evidenceReferences.length, 'items')

// ── 4. generateRMBriefLegacy must return a string, not throw ─────────────────
let legacyBrief
try {
  legacyBrief = await generateRMBriefLegacy('Test RM brief for Lau Chi Ming')
} catch (err) {
  console.error('FAIL — generateRMBriefLegacy threw:', err.message)
  process.exit(1)
}
if (typeof legacyBrief !== 'string' || legacyBrief.length === 0) {
  console.error('FAIL — legacy brief is not a non-empty string')
  process.exit(1)
}
console.log('\n✓  generateRMBriefLegacy() returned a string in fallback mode')
console.log('  First 80 chars:', legacyBrief.slice(0, 80))

// ── 5. Data engine still works without key ───────────────────────────────────
import { loadAllData, validateData } from '../engine/dataLoader.js'
const store = loadAllData()
const v = validateData(store)
if (!v.valid) {
  console.error('FAIL — dataset validation failed:', v.errors)
  process.exit(1)
}
console.log('\n✓  Data engine loads correctly without OpenAI key')
console.log('  Clients:', v.summary.clients, '| Holdings:', v.summary.holdings, '| Events:', v.summary.eventLogEntries)

import { getLauChiMingIntelligence } from '../engine/lauIntelligence.js'
const lau = getLauChiMingIntelligence()
if (!lau || lau.priorityScore === undefined) {
  console.error('FAIL — Lau intelligence failed')
  process.exit(1)
}
console.log('✓  Lau intelligence calculated correctly: priority =', lau.priority, '| score =', lau.priorityScore)

import { scoreAllClients } from '../engine/priorityEngine.js'
const priority = scoreAllClients()
if (priority.totalClients !== 20) {
  console.error('FAIL — expected 20 clients, got', priority.totalClients)
  process.exit(1)
}
console.log('✓  Priority engine: 20 clients scored, #1 is', priority.prioritisedList[0].clientName)

console.log('\n=== ALL FALLBACK TESTS PASSED ===\n')
