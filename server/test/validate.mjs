import { loadAllData, validateData } from '../engine/dataLoader.js'
import { getLauChiMingIntelligence } from '../engine/lauIntelligence.js'
import { getAbdullahIntelligence } from '../engine/abdullahIntelligence.js'
import { getMargartheIntelligence } from '../engine/margaretheIntelligence.js'
import { scoreAllClients } from '../engine/priorityEngine.js'
import { getClientAggregatedPortfolio, compareSnapshots } from '../engine/snapshotEngine.js'
import { getClientIntelligence } from '../engine/intelligenceEngine.js'

let failures = 0
function check(label, cond) {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`)
  if (!cond) failures++
}

console.log('\n=== PHASE 1: Dataset Validation (official counts) ===')
const store = loadAllData()
const v = validateData(store)
console.log('Summary:', JSON.stringify(v.summary))
console.log('Valid:', v.valid, '| errors:', v.errors.length, '| warnings:', v.warnings.length)
check('20 clients', v.summary.clients === 20)
check('24 portfolios', v.summary.portfolios === 24)
check('1015 holdings', v.summary.holdings === 1015)
check('62 instruments', v.summary.instruments === 62)
check('5 credit facilities', v.summary.creditFacilities === 5)
check('20 planned cash needs', v.summary.plannedCashNeeds === 20)
check('16 event log entries', v.summary.eventLogEntries === 16)
check('28 rm notes', v.summary.rmNotes === 28)
check('no validation errors', v.errors.length === 0)

console.log('\n=== PHASE 2: Snapshot Engine — Lau (USD cross-client + HKD base) ===')
const lauAgg = getClientAggregatedPortfolio('CL-0014', '2026-08-26')
console.log('  Total USD:', Math.round(lauAgg.totalUsd).toLocaleString())
console.log('  Allocation:', lauAgg.allocation.map(a => `${a.assetClass}=${a.weightPct}%`).join(' | '))
const lauCmp = compareSnapshots('CL-0014', '2025-12-31', '2026-08-26')
console.log('  Dec31→Aug26 change:', lauCmp.valueChangePct + '%')
check('Lau has USD total', lauAgg.totalUsd > 0)

console.log('\n=== PHASE 3: Lau Intelligence (CL-0014) ===')
const lau = getLauChiMingIntelligence('2026-08-26')
console.log('  Client:', lau.clientName, '| priority', lau.priority, lau.priorityScore)
console.log('  Property concentration:', lau.propertyConcentration.totalPropertyPct + '%')
const lauCf = lau.creditFacilityStatus.facilities[0]
console.log('  Facility', lauCf.facilityId, 'LTV', lauCf.ltvCurrentPct + '% / MC', lauCf.marginCallLtvPct + '% headroom', lauCf.headroomToMarginCallPpts, 'ppts', `[${lauCf.proximityAlert}]`)
const lauNeed = lau.cashRequirement.primaryCashNeed
console.log('  Cash need', lauNeed.needId, lauNeed.amount.toLocaleString(), lauNeed.currency, `${lauNeed.dueFrom}..${lauNeed.dueTo}`)
lau.signals.forEach(s => console.log(`    [${s.severity.toUpperCase()}] ${s.id}: ${s.title}`))
check('Lau name is official', lau.clientName === 'Lau Chi Ming')
check('property concentration ~49%', Math.abs(lau.propertyConcentration.totalPropertyPct - 49.03) < 0.5)
check('CF-0002 LTV 69.41', lauCf.facilityId === 'CF-0002' && Math.abs(lauCf.ltvCurrentPct - 69.41) < 0.01)
check('CF-0002 margin call 70', lauCf.marginCallLtvPct === 70)
check('CF-0002 headroom ~0.59', Math.abs(lauCf.headroomToMarginCallPpts - 0.59) < 0.01)
check('CN-013 HKD 60m', lauNeed.needId === 'CN-013' && lauNeed.amount === 60000000 && lauNeed.currency === 'HKD')
check('Lau scenario present', !!lau.scenario && lau.scenario.scenarioName.includes('Stress Test'))

console.log('\n=== PHASE 4: Abdullah Intelligence (CL-0019) ===')
const abd = getAbdullahIntelligence('2026-08-26')
console.log('  Client:', abd.clientName, '| priority', abd.priority, abd.priorityScore)
const ae = abd.shippingEnergyExposure
console.log('  Shipping', ae.shippingPct + '% | Energy', ae.energyPct + '% | Note', ae.notePct + '% | Combined', ae.combinedShippingEnergyPct + '%')
console.log('  Objective:', abd.objectiveAlignment.alignmentStatus)
console.log('  Hormuz events:', abd.hormuzScenario.authoritativeEventIds.join(', '))
console.log('  Hormuz stress impact:', abd.hormuzScenario.calculatedStressResult.totalStressImpactBase.toLocaleString(), abd.hormuzScenario.calculatedStressResult.baseCurrency, `(${abd.hormuzScenario.calculatedStressResult.portfolioStressImpactPct}%)`)
abd.signals.forEach(s => console.log(`    [${s.severity.toUpperCase()}] ${s.id}: ${s.title}`))
check('Abdullah name official', abd.clientName === 'Abdullah Al-Mansoori')
check('shipping ~20.3%', Math.abs(ae.shippingPct - 20.3) < 1)
check('note ~12.9%', Math.abs(ae.notePct - 12.9) < 0.5)
check('objective MISALIGNED', abd.objectiveAlignment.alignmentStatus === 'MISALIGNED')
check('Hormuz events are official EVT ids', abd.hormuzScenario.authoritativeEventIds.every(id => /^EVT-0\d\d$/.test(id)))
check('Hormuz scenario is stress test not forecast', abd.hormuzScenario.scenarioName.includes('Stress Test'))

console.log('\n=== PHASE 5: Margarethe Intelligence (CL-0003) ===')
const mar = getMargartheIntelligence('2026-08-26')
console.log('  Client:', mar.clientName, '| priority', mar.priority, mar.priorityScore)
console.log('  Equity', mar.equityAnalysis.equityPct + '% vs CONS max', mar.equityAnalysis.mandateEquityMax + '% (breach', mar.equityAnalysis.equityBreachPpts, 'ppts)')
console.log('  Largest position:', mar.equityAnalysis.largestPosition.name, mar.equityAnalysis.largestPosition.weightPct + '%')
const marTax = mar.cashCoverage.find(c => c.needId === 'CN-004')
console.log('  Tax need', marTax.needId, marTax.amount.toLocaleString(), marTax.currency)
mar.signals.forEach(s => console.log(`    [${s.severity.toUpperCase()}] ${s.id}: ${s.title}`))
check('Margarethe name official', mar.clientName === 'Margarethe Voss-Brenner')
check('equity ~71.5%', Math.abs(mar.equityAnalysis.equityPct - 71.46) < 1)
check('CONS equity max 30', mar.equityAnalysis.mandateEquityMax === 30)
check('equity breach present', mar.equityAnalysis.equityBreachPpts > 30)
check('largest position >10%', mar.equityAnalysis.largestPosition.weightPct > 10)
check('CN-004 EUR 3.4m', marTax.needId === 'CN-004' && marTax.amount === 3400000 && marTax.currency === 'EUR')
check('Margarethe scenario present', !!mar.scenario && mar.scenario.scenarioName.includes('Stress Test'))

console.log('\n=== PHASE 6: Priority System — All 20 Clients ===')
const priority = scoreAllClients('2026-08-26')
console.log(`  Total: ${priority.totalClients} | Critical ${priority.criticalCount} High ${priority.highCount} Medium ${priority.mediumCount} Low ${priority.lowCount}`)
priority.prioritisedList.slice(0, 6).forEach((c, i) => {
  console.log(`  #${i + 1} [${c.priority.toUpperCase()}/${c.priorityScore}] ${c.clientName} (${c.clientId}) — ${c.whyThisClient[0] || 'basic monitoring'}`)
})
check('20 clients scored', priority.totalClients === 20)
check('distinct priority scores (not all 1/equal)', new Set(priority.prioritisedList.map(c => c.priorityScore)).size > 1)

console.log('\n=== PHASE 7: Frontend contract via getClientIntelligence ===')
for (const id of ['CL-0014', 'CL-0019', 'CL-0003', 'CL-0001']) {
  const intel = getClientIntelligence(id, '2026-08-26')
  const ok = intel && intel.clientName && Array.isArray(intel.signals) && Array.isArray(intel.scenarios) && intel.rmContext
  console.log(`  ${id}: ${intel.clientName} | signals ${intel.signals.length} | scenarios ${intel.scenarios.length} | priority ${intel.priority}`)
  check(`${id} intelligence contract`, ok)
}

console.log(`\n=== ${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'} ===`)
process.exit(failures === 0 ? 0 : 1)
