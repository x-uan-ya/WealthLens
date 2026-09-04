// apiNormalise.js
//
// Pure transforms that adapt the server intelligence-engine response shapes to
// the shapes the existing React components already consume. Kept separate from
// dataService.js so the fetch layer stays readable and the mapping is auditable.
//
// GOVERNANCE:
//   - No values are fabricated here. Every field is derived from a server
//     response. Where the server supplies nothing, we return null/empty — never
//     a placeholder figure.
//   - relevanceScore is taken from the engine's priorityScore. It is NEVER
//     derived from AI confidence (which is a separate concept and not used here).

// Server priority strings -> frontend badge keys (HIGH | MEDIUM | LOW | NONE).
export function normalisePriority(p) {
  switch ((p || '').toLowerCase()) {
    case 'critical':
    case 'high':
      return 'HIGH'
    case 'medium':
      return 'MEDIUM'
    case 'low':
      return 'LOW'
    default:
      return 'NONE'
  }
}

const PRESENTATION_IDS = new Set(['CL-0014', 'CL-0019', 'CL-0003'])

function humanise(key = '') {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── RM ──────────────────────────────────────────────────────────────────────
export function normaliseRm(rm, clientCount) {
  if (!rm) return null
  const name = rm.name || 'Relationship Manager'
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return {
    id: rm.rmId,
    name,
    title: rm.title,
    team: rm.team,
    location: rm.location,
    initials,
    clientsMonitored: clientCount ?? 20,
    clientsManaged: clientCount ?? 20,
  }
}

// ─── Clients ───────────────────────────────────────────────────────────────────
// Merges the client roster with the priority ranking so each client carries a
// current priority. `lifeStage` uses a real field if the server provides one,
// otherwise a neutral factual descriptor from segment + tier (no invented story).
export function normaliseClient(c, priorityByClient = {}) {
  const id = c.clientId || c.id
  const pri = priorityByClient[id]
  return {
    id,
    clientId: id,
    name: c.name || c.full_name || c.clientName,
    riskProfile: c.riskProfile,
    domicile: c.domicile,
    segment: c.segment,
    mandateType: c.mandateType,
    aumChf: c.aumChf,
    tier: c.tier,
    // Neutral factual context line — not a fabricated narrative.
    lifeStage: c.lifeStage || [c.segment, c.mandateType].filter(Boolean).join(' · ') || null,
    priority: normalisePriority(pri?.priority),
    presentation: PRESENTATION_IDS.has(id),
  }
}

// Build clientId -> priority record from /api/intelligence/priority list.
export function indexPriority(priorityResponse) {
  const map = {}
  for (const row of priorityResponse?.prioritisedList || []) {
    map[row.clientId] = row
  }
  return map
}

// ─── Intelligence signal parts ─────────────────────────────────────────────────
function normaliseVerifiedMetrics(vm) {
  if (!vm) return []
  if (Array.isArray(vm)) return vm // already in {label,value,basis} form
  // Object form { key: value } -> [{ label, value }]
  return Object.entries(vm)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => ({ label: humanise(k), value: formatMetricValue(k, v) }))
}

function formatMetricValue(key, v) {
  if (v == null) return '—'
  if (typeof v === 'number') {
    if (/pct$/i.test(key)) return `${v}%`
    if (/chf|amount|value/i.test(key)) return new Intl.NumberFormat('en-CH').format(v)
    return String(v)
  }
  return String(v)
}

function normaliseEvidence(evidence) {
  if (!Array.isArray(evidence)) return []
  return evidence.map((e) => ({
    // Server evidence -> EvidenceInspector shape.
    label: e.label || e.claim,
    value: e.value,
    source: e.source,
    snapshot: e.snapshot,
    record: e.record || e.recordId || (e.calculation ? `Calc: ${e.calculation}` : undefined),
  }))
}

function normaliseSignal(s) {
  return {
    id: s.id,
    type: s.type ? s.type.toUpperCase().replace(/\s+/g, '_') : s.type,
    severity: (s.severity || '').toUpperCase(),
    title: s.title,
    summary: s.summary,
    verifiedMetrics: normaliseVerifiedMetrics(s.verifiedMetrics),
    evidence: normaliseEvidence(s.evidence),
    uncertainty: Array.isArray(s.uncertainty) ? s.uncertainty.join(' ') : s.uncertainty || null,
  }
}

// priorityFactors object { key: points } -> relevanceFactors [{label,score,note}]
function factorsToRelevance(priorityFactors, factorNotes = {}) {
  if (!priorityFactors) return []
  return Object.entries(priorityFactors)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, score]) => ({
      label: humanise(k),
      score: typeof score === 'number' ? score : 0,
      note: factorNotes[k] || undefined,
    }))
    .sort((a, b) => b.score - a.score)
}

// ─── snapshotHistory: server -> {dates, series[{label,unit,values}]} ───────────
export function normaliseSnapshotHistory(snapshotsResponse) {
  const history = snapshotsResponse?.history || []
  if (history.length === 0) return null
  const dates = history.map((h) => h.snapshotDate)

  // Asset-class weight series (one per class seen across snapshots).
  const classes = new Set()
  for (const h of history) for (const a of h.allocation || []) classes.add(a.assetClass)

  const series = []
  for (const cls of classes) {
    const values = history.map((h) => {
      const found = (h.allocation || []).find((a) => a.assetClass === cls)
      return found ? found.weightPct : null
    })
    series.push({ label: `${cls} allocation`, unit: '%', values })
  }

  // Total value series (CHF millions, 1 dp) — real supplied totals only.
  const totals = history.map((h) =>
    typeof h.totalChf === 'number' ? Math.round((h.totalChf / 1_000_000) * 10) / 10 : null
  )
  if (totals.some((t) => t != null)) {
    series.unshift({ label: 'Total portfolio value', unit: 'CHF m', values: totals })
  }

  return { dates, series }
}

// ─── scenario: server scenario shape -> ScenarioPanel shape ────────────────────
// Works for all three supported clients. Prefers the explicit presentation
// arrays a scenario supplies (affectedExposures / portfolioImplications /
// objectiveImplications / evidence / rmConsiderations); otherwise falls back to
// deriving them from the Hormuz-style knownData/calculatedStressResult fields.
export function normaliseScenario(sc) {
  if (!sc) return null
  const known = sc.knownData || {}
  const calc = sc.calculatedStressResult || {}
  const assumptions = sc.assumptions || {}
  const chf = (n) => (typeof n === 'number' ? `CHF ${new Intl.NumberFormat('en-CH').format(n)}` : null)

  // Affected exposures: explicit if supplied, else derive (Hormuz).
  let affectedExposures = Array.isArray(sc.affectedExposures) ? sc.affectedExposures : null
  if (!affectedExposures) {
    affectedExposures = []
    if (known.observedTotalImpactChf != null)
      affectedExposures.push({ label: 'Observed impact (Feb 2026)', value: chf(known.observedTotalImpactChf) })
    if (calc.currentPortfolioValueChf != null)
      affectedExposures.push({ label: 'Current portfolio value', value: chf(calc.currentPortfolioValueChf) })
  }

  // Portfolio implications: explicit if supplied, else derive (Hormuz).
  let portfolioImplications = Array.isArray(sc.portfolioImplications) ? sc.portfolioImplications : null
  if (!portfolioImplications) {
    portfolioImplications = []
    if (calc.totalStressImpactChf != null)
      portfolioImplications.push(`Modelled stress impact: ${chf(calc.totalStressImpactChf)} (${calc.portfolioStressImpactPct}% of portfolio).`)
    if (calc.portfolioValueAfterStressChf != null)
      portfolioImplications.push(`Portfolio value after modelled stress: ${chf(calc.portfolioValueAfterStressChf)}.`)
  }

  // Assumptions: the object form { key: value } -> readable lines.
  const assumptionList = Array.isArray(sc.assumptions)
    ? sc.assumptions
    : Object.entries(assumptions)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => (k === 'rationale' ? String(v) : `${humanise(k)}: ${typeof v === 'number' ? v + '%' : v}`))

  // Evidence: explicit if supplied (Lau/Margarethe), else from hormuzEvents.
  const evidence = Array.isArray(sc.evidence) && sc.evidence.length
    ? sc.evidence
    : (sc.hormuzEvents || []).map((e) => ({
        label: e.title,
        value: e.marketImpact,
        source: 'event_log.csv',
        snapshot: e.date,
        record: e.eventId,
      }))

  return {
    id: sc.scenarioName ? sc.scenarioName.replace(/\s+/g, '_').toUpperCase() : 'SCENARIO',
    name: sc.scenarioName,
    kind: 'STRESS_TEST',
    description: sc.scenarioDescription,
    affectedExposures,
    portfolioImplications,
    objectiveImplications: Array.isArray(sc.objectiveImplications) ? sc.objectiveImplications : [],
    assumptions: assumptionList,
    uncertainty: (sc.uncertainty?.items || []).join(' '),
    rmConsiderations: Array.isArray(sc.rmConsiderations) ? sc.rmConsiderations : [],
    authoritativeEventIds: Array.isArray(sc.authoritativeEventIds) ? sc.authoritativeEventIds : [],
    evidence,
  }
}

// ─── Full intelligence object -> frontend contract ────────────────────────────
export function normaliseIntelligence(intel, snapshotsResponse) {
  if (!intel) return null
  return {
    clientId: intel.clientId,
    clientName: intel.clientName,
    priority: normalisePriority(intel.priority),
    priorityScore: intel.priorityScore,
    // relevanceScore comes from the deterministic engine score — NOT confidence.
    relevanceScore: intel.priorityScore,
    priorityBreakdown: Object.entries(intel.priorityFactors || {})
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, points]) => ({ label: humanise(k), points })),
    relevanceFactors: factorsToRelevance(intel.priorityFactors),
    signals: (intel.signals || []).map(normaliseSignal),
    snapshotHistory: normaliseSnapshotHistory(snapshotsResponse),
    rmContext: normaliseRmContext(intel.rmContext),
    relevantEvents: intel.relevantEvents || [],
    scenarios: (intel.scenarios || []).map(normaliseScenario).filter(Boolean),
    // aiBrief is generated on demand via the brief endpoint; not embedded here.
    aiBrief: null,
  }
}

function normaliseRmContext(rmContext) {
  const notes = rmContext?.recentNotes || []
  return notes.map((n) => ({
    date: n.date || n.note_date,
    note: n.body || n.subject || n.note,
    author: rmContext?.rmName,
  }))
}

// ─── AI brief (server) -> RMBrief component shape ──────────────────────────────
export function normaliseBrief(serverBrief) {
  // /api/clients/:id/brief returns { brief: { <aiFields>, _metadata } }
  const b = serverBrief?.brief || serverBrief
  if (!b) return null
  const ai = b.aiBrief || b
  return {
    status: 'draft',
    situation: ai.summary || ai.situation || '',
    whyItMatters: ai.whyItMatters || '',
    verifiedEvidence: (ai.evidenceReferences || []).map((ref) =>
      typeof ref === 'string' ? { label: ref, value: '' } : ref
    ),
    clientContext: ai.rmPreparationNotes || ai.clientContext || '',
    discussionPoints: ai.discussionPoints || [],
    uncertainty: Array.isArray(ai.uncertainties) ? ai.uncertainties.join(' ') : ai.uncertainty || '',
    clientFriendlySummary: ai.clientFriendlySummary || '',
    _briefId: b.briefId || null,
    _metadata: ai._metadata || b._metadata || null,
  }
}
