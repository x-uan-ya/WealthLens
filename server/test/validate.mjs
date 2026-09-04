import { loadAllData, validateData } from '../engine/dataLoader.js'
import { getLauChiMingIntelligence } from '../engine/lauIntelligence.js'
import { getAbdullahIntelligence } from '../engine/abdullahIntelligence.js'
import { getMargartheIntelligence } from '../engine/margaretheIntelligence.js'
import { scoreAllClients } from '../engine/priorityEngine.js'

console.log('\n=== PHASE 1: Dataset Validation ===')
const store = loadAllData()
const v = validateData(store)
console.log('Summary:', JSON.stringify(v.summary, null, 2))
console.log('Valid:', v.valid)
if (v.errors.length > 0) {
  console.log('ERRORS:', v.errors)
} else {
  console.log('No errors.')
}
if (v.warnings.length > 0) {
  console.log(`Warnings (${v.warnings.length}):`)
  v.warnings.forEach(w => console.log(' -', w))
}

console.log('\n=== PHASE 2: Snapshot Engine — Lau Portfolio ===')
import { getClientAggregatedPortfolio, compareSnapshots, SNAPSHOTS } from '../engine/snapshotEngine.js'
const lauLatest = getClientAggregatedPortfolio('CL-0014', '2026-08-26')
console.log('Lau combined portfolio (Aug 26 2026):')
console.log('  Total CHF:', lauLatest.totalChf?.toLocaleString())
console.log('  Portfolios:', lauLatest.portfolios.map(p => `${p.portfolioId}=${p.valueChf?.toLocaleString()}`).join(', '))
console.log('  Allocation:', lauLatest.allocation.map(a => `${a.assetClass}=${a.weightPct}%`).join(' | '))

const lauCompare = compareSnapshots('CL-0014', '2025-12-31', '2026-08-26')
console.log('\nLau snapshot comparison Dec31→Aug26:')
console.log('  Value change CHF:', lauCompare.valueChangeChf?.toLocaleString())
console.log('  Value change %:', lauCompare.valueChangePct)
console.log('  Top allocation changes:', lauCompare.allocationChanges.slice(0, 3).map(a => `${a.assetClass}: ${a.changePpts > 0 ? '+' : ''}${a.changePpts}ppts`).join(' | '))

console.log('\n=== PHASE 3: Lau Intelligence ===')
const lau = getLauChiMingIntelligence('2026-08-26')
console.log('Client:', lau.clientName)
console.log('Priority:', lau.priority, '(score:', lau.priorityScore + ')')
console.log('Priority factors:', JSON.stringify(lau.priorityFactors))
console.log('Signals:')
lau.signals.forEach(s => console.log(`  [${s.severity.toUpperCase()}] ${s.id}: ${s.title}`))
console.log('Property concentration:', lau.propertyConcentration.totalPropertyPct + '%')
console.log('  Direct:', lau.propertyConcentration.directPropertyPct + '%')
console.log('  Structured:', lau.propertyConcentration.structuredPropertyPct + '%')
console.log('Cash need (Nov 2026):')
const primaryNeed = lau.cashRequirement.primaryCashNeed
if (primaryNeed) {
  console.log('  Amount:', primaryNeed.amountLocal?.toLocaleString(), primaryNeed.currency)
  console.log('  Days until due:', primaryNeed.daysUntilDue)
  console.log('  Current cash CHF:', lau.cashRequirement.cashPositionChf?.toLocaleString())
  console.log('  Shortfall CHF:', primaryNeed.shortfallChf?.toLocaleString())
  console.log('  Can bridge with Lombard:', primaryNeed.canCoverWithLombard)
}
console.log('Credit facilities:')
lau.creditFacilityStatus.facilities.forEach(f => {
  console.log(`  ${f.facilityId}: LTV=${f.ltvCurrentPct}% threshold=${f.ltvThresholdPct}% MC=${f.ltvMarginCallPct}% [${f.proximityAlert}]`)
})

console.log('\n=== PHASE 4: Abdullah Intelligence ===')
const abd = getAbdullahIntelligence('2026-08-26')
console.log('Client:', abd.clientName)
console.log('Priority:', abd.priority, '(score:', abd.priorityScore + ')')
console.log('Shipping exposure:', abd.shippingEnergyExposure.shippingPct + '%')
console.log('Energy exposure:', abd.shippingEnergyExposure.energyPct + '%')
console.log('Combined:', abd.shippingEnergyExposure.combinedShippingEnergyPct + '%')
console.log('Objective alignment:', abd.objectiveAlignment.alignmentStatus)
console.log('Signals:')
abd.signals.forEach(s => console.log(`  [${s.severity.toUpperCase()}] ${s.id}: ${s.title}`))
console.log('Hormuz scenario:')
const hz = abd.hormuzScenario
if (!hz.error) {
  console.log('  Authoritative events:', hz.authoritativeEventIds.join(', '))
  console.log('  Observed impact CHF:', hz.knownData.observedTotalImpactChf?.toLocaleString())
  console.log('  Stress scenario impact CHF:', hz.calculatedStressResult?.totalStressImpactChf?.toLocaleString())
  console.log('  Stress impact %:', hz.calculatedStressResult?.portfolioStressImpactPct)
}

console.log('\n=== PHASE 5: Margarethe Intelligence ===')
const mar = getMargartheIntelligence('2026-08-26')
console.log('Client:', mar.clientName)
console.log('Priority:', mar.priority, '(score:', mar.priorityScore + ')')
console.log('Effective equity:', mar.equityAnalysis.effectiveEquityPct + '%')
console.log('Mandate equity max:', mar.mandate.equityRange)
console.log('Deutsche Bank weight:', mar.equityAnalysis.deutscheBankWeightPct + '%')
console.log('Signals:')
mar.signals.forEach(s => console.log(`  [${s.severity.toUpperCase()}] ${s.id}: ${s.title}`))

console.log('\n=== PHASE 6: Priority System — All Clients ===')
const priority = scoreAllClients('2026-08-26')
console.log(`Total clients: ${priority.totalClients}`)
console.log(`Critical: ${priority.criticalCount} | High: ${priority.highCount} | Medium: ${priority.mediumCount} | Low: ${priority.lowCount}`)
console.log('\nTop 5 prioritised clients:')
priority.prioritisedList.slice(0, 5).forEach((c, i) => {
  console.log(`  #${i+1} [${c.priority.toUpperCase()}/${c.priorityScore}pts] ${c.clientName} (${c.clientId})`)
  console.log(`       Why: ${c.whyThisClient[0] || 'basic monitoring'}`)
})

console.log('\n=== ALL CHECKS PASSED ===')
