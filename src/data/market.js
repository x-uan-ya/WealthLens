// Mock market context. This is deliberately light: WealthLens is not a
// market-data terminal. Markets are only shown to explain client relevance.
// Replace with GET /api/market later.

export const marketSnapshot = [
  { id: 'eq-world', label: 'MSCI World', value: '3,842', changePct: 0.4, direction: 'up' },
  { id: 'eq-eu', label: 'Euro Stoxx 50', value: '5,106', changePct: -0.3, direction: 'down' },
  { id: 'rate-us10', label: 'US 10Y', value: '4.12%', changePct: 0.06, direction: 'up' },
  { id: 'fx-eurusd', label: 'EUR/USD', value: '1.114', changePct: 0.5, direction: 'up' },
  { id: 'cm-gold', label: 'Gold', value: '2,486', changePct: 0.2, direction: 'up' },
]

// Short, human context notes that a signal engine might attach.
export const marketNarratives = [
  {
    id: 'mn-1',
    title: 'Currency moves are the quarter\u2019s real story',
    body: 'Broad indices are close to flat, but EUR strength against USD is meaningful for clients with cross-currency income. This is where attention is best spent.',
  },
  {
    id: 'mn-2',
    title: 'Rate expectations firmed slightly',
    body: 'Markets now price fewer cuts this year. Relevant mainly for income-oriented, rate-sensitive portfolios rather than the broad book.',
  },
]
