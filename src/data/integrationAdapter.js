// =============================================================================
// INTEGRATION ADAPTER  —  SINGLE SOURCE OF TEMPORARY DATA
// =============================================================================
//
// This is the ONLY file that holds temporary / placeholder intelligence data
// for the frontend. The intelligence engine (built by the other developer) will
// eventually return objects matching the CONTRACT below. When that layer is
// ready, replace the bodies of the exported functions at the bottom of this
// file with real calls — every UI component already consumes this shape, so no
// JSX needs to change.
//
// DO NOT scatter placeholder values across components. Add them here only.
//
// -----------------------------------------------------------------------------
// INTELLIGENCE CONTRACT (per-client object)
// -----------------------------------------------------------------------------
// {
//   clientId,                     // e.g. "CL-0014"
//   priority,                     // "HIGH" | "MEDIUM" | "LOW" | "NONE"
//   priorityScore,                // number (documented components, not magic)
//   priorityBreakdown: [ { label, points } ],
//   relevanceScore,               // 0..100  (NOT AI confidence)
//   relevanceFactors: [ { label, score, note } ],
//   signals: [
//     {
//       id, type, severity,       // type: CONCENTRATION|LIQUIDITY|COLLATERAL|...
//       title, summary,           // severity: HIGH|MEDIUM|LOW
//       verifiedMetrics: [ { label, value, basis } ],
//       evidence: [ { label, value, source, snapshot, record } ],
//       uncertainty               // string | null
//     }
//   ],
//   snapshotHistory: {            // renders supplied values; FE does NO maths
//     dates: [ ...5 official dates ],
//     series: [ { label, unit, values: [...5] } ]
//   },
//   rmContext: [ { date, note, author } ],
//   scenarios: [ scenarioObject ],
//   aiBrief: briefObject | null
// }
// =============================================================================

// The five official portfolio snapshot dates (shared by all clients).
export const OFFICIAL_SNAPSHOT_DATES = [
  '2025-12-31',
  '2026-02-27',
  '2026-03-31',
  '2026-06-30',
  '2026-08-26',
]

// -----------------------------------------------------------------------------
// OFFICIAL RM
// -----------------------------------------------------------------------------
export const officialRm = {
  id: 'rm-priscilla',
  name: 'Priscilla Ong',
  title: 'Relationship Manager',
  team: 'Julius Baer — Wealth Intelligence',
  location: 'Singapore, SG',
  initials: 'PO',
  email: 'priscilla.ong@juliusbaer.example',
  clientsMonitored: 20,
}

// -----------------------------------------------------------------------------
// OFFICIAL CLIENTS (identity-level only)
// No invented financial figures here. Portfolio value / allocation / cash needs
// come from the intelligence layer. `priority` mirrors the current intelligence
// bucket so the dashboard can group clients; it defaults to "NONE" until the
// engine assigns one.
//
// The 3 presentation clients (CL-0014, CL-0019, CL-0003) have full intelligence
// objects further down. The remaining 17 are placeholders with identity data
// only, awaiting the official dataset.
// -----------------------------------------------------------------------------
export const officialClients = [
  { id: 'CL-0014', name: 'Lau Chi Ming', riskProfile: 'Balanced', domicile: 'Hong Kong', lifeStage: 'Business owner, pre-liquidity event', priority: 'HIGH', presentation: true },
  { id: 'CL-0019', name: 'Abdullah Al-Mansoori', riskProfile: 'Growth', domicile: 'Abu Dhabi, UAE', lifeStage: 'Second-generation wealth', priority: 'HIGH', presentation: true },
  { id: 'CL-0003', name: 'Margarethe Voss-Brenner', riskProfile: 'Conservative', domicile: 'Zurich, CH', lifeStage: 'Inherited portfolio, upcoming tax event', priority: 'HIGH', presentation: true },

  { id: 'CL-0001', name: 'Henrik Sørensen', riskProfile: 'Balanced', domicile: 'Oslo, NO', lifeStage: 'Established wealth', priority: 'MEDIUM' },
  { id: 'CL-0002', name: 'Yuki Tanaka', riskProfile: 'Growth', domicile: 'Tokyo, JP', lifeStage: 'Entrepreneur', priority: 'MEDIUM' },
  { id: 'CL-0004', name: 'Rajesh Malhotra', riskProfile: 'Growth', domicile: 'Mumbai, IN', lifeStage: 'Family business', priority: 'MEDIUM' },
  { id: 'CL-0005', name: 'Sophie Dubois', riskProfile: 'Conservative', domicile: 'Geneva, CH', lifeStage: 'Retirement', priority: 'LOW' },
  { id: 'CL-0006', name: 'Carlos Mendoza', riskProfile: 'Balanced', domicile: 'Madrid, ES', lifeStage: 'Established wealth', priority: 'LOW' },
  { id: 'CL-0007', name: 'Amina Diallo', riskProfile: 'Growth', domicile: 'Dubai, UAE', lifeStage: 'Professional', priority: 'MEDIUM' },
  { id: 'CL-0008', name: 'Thomas Müller', riskProfile: 'Conservative', domicile: 'Munich, DE', lifeStage: 'Retirement', priority: 'NONE' },
  { id: 'CL-0009', name: 'Isabella Rossi', riskProfile: 'Balanced', domicile: 'Milan, IT', lifeStage: 'Established wealth', priority: 'LOW' },
  { id: 'CL-0010', name: 'Wei Chen', riskProfile: 'Growth', domicile: 'Singapore, SG', lifeStage: 'Entrepreneur', priority: 'MEDIUM' },
  { id: 'CL-0011', name: 'Fatima Al-Sayed', riskProfile: 'Conservative', domicile: 'Doha, QA', lifeStage: 'Family office', priority: 'NONE' },
  { id: 'CL-0012', name: 'James Whitfield', riskProfile: 'Balanced', domicile: 'London, UK', lifeStage: 'Established wealth', priority: 'LOW' },
  { id: 'CL-0013', name: 'Priya Nair', riskProfile: 'Growth', domicile: 'Bangalore, IN', lifeStage: 'Professional', priority: 'NONE' },
  { id: 'CL-0015', name: 'Olivia Bennett', riskProfile: 'Balanced', domicile: 'Sydney, AU', lifeStage: 'Established wealth', priority: 'LOW' },
  { id: 'CL-0016', name: 'Mohammed Rahman', riskProfile: 'Growth', domicile: 'Kuala Lumpur, MY', lifeStage: 'Family business', priority: 'MEDIUM' },
  { id: 'CL-0017', name: 'Elena Petrova', riskProfile: 'Conservative', domicile: 'Vienna, AT', lifeStage: 'Retirement', priority: 'NONE' },
  { id: 'CL-0018', name: 'David Kim', riskProfile: 'Growth', domicile: 'Seoul, KR', lifeStage: 'Entrepreneur', priority: 'LOW' },
  { id: 'CL-0020', name: 'Grace Oyelaran', riskProfile: 'Balanced', domicile: 'Lagos, NG', lifeStage: 'Professional', priority: 'NONE' },
]

// -----------------------------------------------------------------------------
// PRESENTATION-CLIENT INTELLIGENCE OBJECTS  (contract-shaped, PLACEHOLDER data)
// These illustrate the full contract for the 3 demo clients. Figures are
// placeholders pending the real engine; they are grounded to look plausible but
// must not be treated as verified until the data layer supplies them.
// -----------------------------------------------------------------------------

const lauIntelligence = {
  clientId: 'CL-0014',
  priority: 'HIGH',
  priorityScore: 94,
  priorityBreakdown: [
    { label: 'Concentration severity', points: 25 },
    { label: 'Collateral proximity', points: 25 },
    { label: 'Liquidity requirement', points: 20 },
    { label: 'Goal impact', points: 15 },
    { label: 'Timing', points: 9 },
  ],
  relevanceScore: 92,
  relevanceFactors: [
    { label: 'Portfolio Exposure', score: 91, note: 'Property-linked exposure concentrated across correlated holdings.' },
    { label: 'Market Impact', score: 78, note: 'Property and rate sensitivity moving together.' },
    { label: 'Goal Sensitivity', score: 94, note: 'Directly touches an upcoming liquidity requirement.' },
    { label: 'Urgency', score: 90, note: 'Liquidity requirement and LTV proximity are near-term.' },
  ],
  signals: [
    {
      id: 'CL-0014-CONC',
      type: 'CONCENTRATION',
      severity: 'HIGH',
      title: 'Property-linked concentration',
      summary: 'Real-estate and property-linked holdings form a large, correlated share of the portfolio.',
      verifiedMetrics: [
        { label: 'Property-linked exposure', value: '41.2%', basis: 'Sum of property/REIT holdings ÷ portfolio value' },
        { label: 'Largest single holding', value: '18.6%', basis: 'Top holding weight' },
      ],
      evidence: [
        { label: 'Property-linked exposure', value: '41.2%', source: 'holdings.csv', snapshot: '2026-08-26', record: 'aggregated property/REIT lines' },
        { label: 'Instrument classification', value: 'Real estate / REIT', source: 'instruments.csv', snapshot: '2026-08-26', record: 'sector tags' },
      ],
      uncertainty: 'Classification of mixed-use holdings may shift the exposure figure by a few points.',
    },
    {
      id: 'CL-0014-LIQ',
      type: 'LIQUIDITY',
      severity: 'HIGH',
      title: 'Upcoming liquidity requirement',
      summary: 'A near-term cash requirement sits against limited liquid assets.',
      verifiedMetrics: [
        { label: 'Liquidity requirement', value: 'S$4,000,000', basis: 'planned_cash_needs record' },
        { label: 'Timeframe', value: 'Within ~3 months', basis: 'planned_cash_needs due date' },
        { label: 'Liquid assets', value: 'Below requirement', basis: 'Cash + near-cash holdings' },
      ],
      evidence: [
        { label: 'Planned cash need', value: 'S$4,000,000', source: 'planned_cash_needs.csv', snapshot: '2026-08-26', record: 'scheduled outflow' },
        { label: 'Cash position', value: 'See holdings', source: 'holdings.csv', snapshot: '2026-08-26', record: 'cash line' },
      ],
      uncertainty: 'Exact timing of the requirement may move with the underlying transaction.',
    },
    {
      id: 'CL-0014-LTV',
      type: 'COLLATERAL',
      severity: 'HIGH',
      title: 'LTV approaching margin-call threshold',
      summary: 'Loan-to-value on the credit facility is close to the margin-call level.',
      verifiedMetrics: [
        { label: 'Current LTV', value: '69.41%', basis: 'Loan ÷ collateral value' },
        { label: 'Margin-call threshold', value: '70.00%', basis: 'Facility terms' },
        { label: 'Headroom', value: '0.59 pts', basis: 'Threshold − current' },
      ],
      evidence: [
        { label: 'Current LTV', value: '69.41%', source: 'credit_facilities.csv', snapshot: '2026-08-26', record: 'facility LTV' },
        { label: 'Margin-call threshold', value: '70.00%', source: 'credit_facilities.csv', snapshot: '2026-08-26', record: 'facility terms' },
      ],
      uncertainty: 'LTV moves with collateral valuation; a small price drop could breach the threshold.',
    },
  ],
  snapshotHistory: {
    dates: OFFICIAL_SNAPSHOT_DATES,
    series: [
      { label: 'Property-linked exposure', unit: '%', values: [33.1, 35.8, 37.2, 39.6, 41.2] },
      { label: 'Current LTV', unit: '%', values: [58.2, 61.0, 63.4, 66.8, 69.41] },
      { label: 'Liquid assets', unit: 'S$m', values: [6.2, 5.4, 4.9, 3.8, 2.6] },
    ],
  },
  rmContext: [
    { date: '2026-07-15', note: 'Client mentioned a property completion expected in Q4 requiring liquidity.', author: 'Priscilla Ong' },
    { date: '2026-05-02', note: 'Prefers to avoid selling core holdings; open to facility adjustments.', author: 'Priscilla Ong' },
  ],
  scenarios: [],
  // Placeholder RM brief. The real engine will return this shape from aiBrief.
  // The frontend never executes anything from it; it is a draft for human review.
  aiBrief: {
    status: 'draft', // 'draft' | 'ready' | 'rejected'
    situation:
      'Property-linked holdings have grown to 41.2% of the portfolio while the credit-facility LTV sits at 69.41%, just under the 70% margin-call threshold. A S$4,000,000 liquidity requirement is due within roughly three months.',
    whyItMatters:
      'A concentrated, correlated exposure combined with limited headroom on the facility and a near-term cash need means a modest fall in property valuations could trigger a margin call at the same time liquidity is required, forcing a poorly-timed sale.',
    verifiedEvidence: [
      { label: 'Property-linked exposure', value: '41.2%', source: 'holdings.csv', snapshot: '2026-08-26' },
      { label: 'Current LTV', value: '69.41%', source: 'credit_facilities.csv', snapshot: '2026-08-26' },
      { label: 'Margin-call threshold', value: '70.00%', source: 'credit_facilities.csv', snapshot: '2026-08-26' },
      { label: 'Liquidity requirement', value: 'S$4,000,000 within ~3 months', source: 'planned_cash_needs.csv', snapshot: '2026-08-26' },
    ],
    clientContext:
      'Business owner ahead of a liquidity event. Prefers not to sell core holdings and is open to facility adjustments.',
    discussionPoints: [
      'Options to create headroom on the facility before valuations move.',
      'Sequencing the Q4 liquidity requirement without forced sales.',
      'Whether partial de-risking of property-linked exposure is acceptable to the client.',
    ],
    uncertainty:
      'LTV depends on collateral valuation, which can move quickly. Exact timing of the liquidity requirement may shift with the underlying transaction.',
  },
}

const abdullahIntelligence = {
  clientId: 'CL-0019',
  priority: 'HIGH',
  priorityScore: 81,
  priorityBreakdown: [
    { label: 'Objective contradiction', points: 30 },
    { label: 'Concentration severity', points: 22 },
    { label: 'Goal impact', points: 18 },
    { label: 'Timing', points: 11 },
  ],
  relevanceScore: 84,
  relevanceFactors: [
    { label: 'Portfolio Exposure', score: 82, note: 'Shipping / energy-linked exposure remains significant.' },
    { label: 'Market Impact', score: 76, note: 'Regional shipping and energy sensitivity.' },
    { label: 'Goal Sensitivity', score: 90, note: 'Contradicts a stated diversification objective.' },
    { label: 'Urgency', score: 62, note: 'Structural rather than immediate.' },
  ],
  signals: [
    {
      id: 'CL-0019-ALIGN',
      type: 'OBJECTIVE_CONTRADICTION',
      severity: 'HIGH',
      title: 'Client objective vs portfolio reality',
      summary: 'Stated objective is to diversify away from Gulf/shipping, yet the portfolio retains significant shipping/energy exposure.',
      verifiedMetrics: [
        { label: 'Stated objective', value: 'Diversify away from Gulf/shipping', basis: 'Client objective record' },
        { label: 'Shipping/energy exposure', value: '34.7%', basis: 'Sum of related holdings ÷ portfolio value' },
      ],
      evidence: [
        { label: 'Client objective', value: 'Diversify away from Gulf/shipping', source: 'rm_notes.json', snapshot: '2026-08-26', record: 'objective note' },
        { label: 'Shipping/energy exposure', value: '34.7%', source: 'holdings.csv', snapshot: '2026-08-26', record: 'aggregated shipping/energy lines' },
      ],
      uncertainty: 'Some diversified funds may carry indirect shipping/energy exposure not captured here.',
    },
  ],
  snapshotHistory: {
    dates: OFFICIAL_SNAPSHOT_DATES,
    series: [
      { label: 'Shipping/energy exposure', unit: '%', values: [39.5, 38.1, 37.0, 35.6, 34.7] },
    ],
  },
  rmContext: [
    { date: '2026-06-20', note: 'Reiterated wish to reduce regional shipping concentration over time.', author: 'Priscilla Ong' },
  ],
  scenarios: [
    {
      id: 'STRAIT_NORMALISATION',
      name: 'Strait normalisation',
      kind: 'STRESS_TEST',
      description: 'A normalisation of regional shipping conditions and freight rates.',
      affectedExposures: [
        { label: 'Shipping/energy holdings', value: '34.7% of portfolio' },
      ],
      portfolioImplications: [
        'Freight-sensitive holdings would likely see reduced earnings support.',
        'Concentration risk becomes more visible if regional demand softens.',
      ],
      objectiveImplications: [
        'Reinforces the case for the client\u2019s stated diversification objective.',
      ],
      assumptions: [
        'Assumes gradual normalisation rather than a sudden shock.',
        'Assumes current holding weights as of the latest snapshot.',
      ],
      uncertainty: 'Direction and timing of regional shipping conditions are uncertain; this is a stress test, not a forecast.',
      evidence: [
        { label: 'Shipping/energy exposure', value: '34.7%', source: 'holdings.csv', snapshot: '2026-08-26', record: 'aggregated lines' },
      ],
    },
  ],
  aiBrief: null,
}

const margaretheIntelligence = {
  clientId: 'CL-0003',
  priority: 'HIGH',
  priorityScore: 76,
  priorityBreakdown: [
    { label: 'Mandate breach severity', points: 28 },
    { label: 'Liquidity requirement', points: 20 },
    { label: 'Goal impact', points: 16 },
    { label: 'Timing', points: 12 },
  ],
  relevanceScore: 80,
  relevanceFactors: [
    { label: 'Portfolio Exposure', score: 88, note: 'Equity allocation well above mandate range.' },
    { label: 'Market Impact', score: 70, note: 'Elevated equity sensitivity vs risk profile.' },
    { label: 'Goal Sensitivity', score: 82, note: 'Conflicts with conservative profile and upcoming tax payment.' },
    { label: 'Urgency', score: 68, note: 'Tax payment approaching.' },
  ],
  signals: [
    {
      id: 'CL-0003-MANDATE',
      type: 'MANDATE_BREACH',
      severity: 'HIGH',
      title: 'Allocation outside mandate range',
      summary: 'Actual equity allocation sits well above the mandated range for a conservative profile.',
      verifiedMetrics: [
        { label: 'Risk profile', value: 'Conservative', basis: 'Client profile' },
        { label: 'Mandate equity range', value: '10–30%', basis: 'mandates record' },
        { label: 'Current equity', value: '~71%', basis: 'Equity holdings ÷ portfolio value' },
        { label: 'Status', value: 'OUT OF BAND', basis: 'Current vs mandate range' },
      ],
      evidence: [
        { label: 'Mandate equity range', value: '10–30%', source: 'mandates.csv', snapshot: '2026-08-26', record: 'mandate band' },
        { label: 'Current equity allocation', value: '~71%', source: 'holdings.csv', snapshot: '2026-08-26', record: 'equity lines' },
      ],
      uncertainty: 'Mandate interpretation for inherited assets may allow a transition period.',
    },
    {
      id: 'CL-0003-LIQ',
      type: 'LIQUIDITY',
      severity: 'MEDIUM',
      title: 'Upcoming tax payment',
      summary: 'A significant tax payment is due, requiring liquidity planning.',
      verifiedMetrics: [
        { label: 'Tax payment', value: 'Significant (see cash needs)', basis: 'planned_cash_needs record' },
      ],
      evidence: [
        { label: 'Planned cash need', value: 'Tax payment', source: 'planned_cash_needs.csv', snapshot: '2026-08-26', record: 'scheduled outflow' },
      ],
      uncertainty: 'Exact amount subject to final assessment.',
    },
  ],
  snapshotHistory: {
    dates: OFFICIAL_SNAPSHOT_DATES,
    series: [
      { label: 'Equity allocation', unit: '%', values: [64.0, 66.5, 68.1, 69.8, 71.0] },
      { label: 'Mandate upper bound', unit: '%', values: [30, 30, 30, 30, 30] },
    ],
  },
  rmContext: [
    { date: '2026-08-01', note: 'Portfolio inherited; client circumstances differ from original holder. Significant tax payment upcoming.', author: 'Priscilla Ong' },
  ],
  scenarios: [],
  aiBrief: null,
}

const INTELLIGENCE_BY_CLIENT = {
  'CL-0014': lauIntelligence,
  'CL-0019': abdullahIntelligence,
  'CL-0003': margaretheIntelligence,
}

// -----------------------------------------------------------------------------
// ADAPTER FUNCTIONS  —  the seam the real engine replaces.
// dataService.js calls these; components call dataService, never this file.
// -----------------------------------------------------------------------------
export const adapterGetRm = () => officialRm

export const adapterGetClients = () => officialClients

export const adapterGetClientById = (id) =>
  officialClients.find((c) => c.id === id) || null

export const adapterGetIntelligenceForClient = (id) =>
  INTELLIGENCE_BY_CLIENT[id] || null

export const adapterHasIntelligence = (id) =>
  Boolean(INTELLIGENCE_BY_CLIENT[id])

export const adapterGetSnapshotDates = () => OFFICIAL_SNAPSHOT_DATES

// --- RM brief review state ---------------------------------------------------
// Human-in-the-loop review status per client, held in memory so the demo can
// move a brief draft -> ready -> (gates the client-facing view). A real backend
// would persist this (PATCH /api/clients/:id/brief). Seeded from any aiBrief.status.
const briefStatusByClient = Object.fromEntries(
  Object.entries(INTELLIGENCE_BY_CLIENT).map(([id, intel]) => [
    id,
    intel.aiBrief?.status || 'none',
  ])
)

export const adapterGetBriefStatus = (id) => briefStatusByClient[id] || 'none'

export const adapterSetBriefStatus = (id, status) => {
  briefStatusByClient[id] = status
  return status
}

export const adapterGetBrief = (id) => INTELLIGENCE_BY_CLIENT[id]?.aiBrief || null
