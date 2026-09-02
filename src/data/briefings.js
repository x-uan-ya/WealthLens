// Mock meeting briefings. Each briefing packages the intelligence a
// Relationship Manager needs before a specific client interaction.
// Replace with GET /api/briefings later.

export const briefings = [
  {
    id: 'br-001',
    clientId: 'cl-002',
    clientName: 'Henrik Falk',
    meetingType: 'Portfolio review call',
    scheduledFor: '2026-09-02T14:00:00',
    status: 'Ready',
    summary:
      'Focus on the concentration build-up in the core tech holding and present a staged diversification plan ahead of earnings.',
    talkingPoints: [
      'Concentration has grown to 31.4% through appreciation, not new buys',
      'Implied volatility is elevated going into earnings',
      'Propose extending the protective put overlay this week',
      'Outline a phased sell-down aligned with venture liquidity needs',
    ],
    relatedSignals: ['sig-001'],
    prep: [
      'Refresh single-stock exposure figures',
      'Draft two diversification scenarios in Scenario Lab',
      'Confirm overlay pricing with the desk',
    ],
  },
  {
    id: 'br-002',
    clientId: 'cl-003',
    clientName: 'The Vásquez Family Office',
    meetingType: 'Family office in person',
    scheduledFor: '2026-09-04T10:30:00',
    status: 'Ready',
    summary:
      'Address currency risk to family income and present a partial EUR/USD hedge sized to upcoming distributions.',
    talkingPoints: [
      'EUR strength is the real risk to distributable income, not markets',
      '38% of income assets are USD denominated and unhedged',
      'Partial forward hedge covering the next two distributions',
      'Reaffirm the capital-preservation and stable-income mandate',
    ],
    relatedSignals: ['sig-002'],
    prep: [
      'Size the forward hedge to the next two distributions',
      'Prepare a before-and-after income illustration',
      'Coordinate with FX desk on indicative pricing',
    ],
  },
  {
    id: 'br-003',
    clientId: 'cl-001',
    clientName: 'Amara Okonkwo',
    meetingType: 'Wealth planning session',
    scheduledFor: '2026-09-09T15:00:00',
    status: 'Drafting',
    summary:
      'Formalise the multi-generational transfer discussion and present two structuring options with the estate specialist.',
    talkingPoints: [
      'Both heirs reaching financial-independence milestones this year',
      'A natural, client-led moment to formalise structures',
      'Revisit the philanthropy vehicle discussed previously',
      'Emphasise continuity and low transfer friction',
    ],
    relatedSignals: ['sig-003'],
    prep: [
      'Invite the estate-planning specialist',
      'Prepare two structure options with trade-offs',
      'Summarise current asset location for transfer',
    ],
  },
  {
    id: 'br-004',
    clientId: 'cl-005',
    clientName: 'Dr. Wilhelm Braun',
    meetingType: 'Reconnect call',
    scheduledFor: '2026-09-03T09:00:00',
    status: 'Ready',
    summary:
      'Re-establish contact after a lapsed cadence, framed around upcoming bond maturities and reinvestment at current yields.',
    talkingPoints: [
      'Acknowledge the gap since the last conversation',
      'Two ladder rungs maturing this quarter',
      'Reinvestment yields currently above maturing coupons',
      'Reassure on stable retirement income',
    ],
    relatedSignals: ['sig-004', 'sig-007'],
    prep: [
      'Pull the maturity schedule for the next two quarters',
      'Show an income uplift illustration',
    ],
  },

  // ── br-005: Catherine Tan ───────────────────────────────────────────────
  // Prototype RM briefing. All content is mock data for demonstration purposes.
  // This is a preparation aid for the Relationship Manager; it does not
  // constitute investment advice or a buy/sell recommendation.
  {
    id: 'br-005',
    clientId: 'C041',
    clientName: 'Catherine Tan',
    meetingType: 'Portfolio review discussion',
    scheduledFor: '2026-09-10T11:00:00',
    status: 'Drafting',

    // summary is used by the existing Briefings UI (list and detail header).
    // Keep it aligned with situation so the page renders correctly today.
    summary:
      'Review technology-sector concentration in the context of recent market volatility and an upcoming liquidity requirement. The RM should determine whether the current positioning remains aligned with Catherine\'s stated objectives.',

    // ── Extended fields for the enhanced briefing view (Page 7) ────────────

    situation:
      'Recent technology-sector volatility intersects with Catherine Tan\'s concentrated technology exposure.',

    whyItMatters:
      'Catherine holds 27.8% of her portfolio in technology-related positions, with NVIDIA, TSMC and Apple as the three largest individual holdings. Her mandate is Advisory with a Balanced (Moderate) risk profile, which implies a meaningful but bounded tolerance for drawdown. Separately, she has a stated S$300,000 liquidity requirement due within four months. The combination of elevated sector concentration, a Balanced risk profile and a near-term liquidity commitment means that a sustained technology-sector correction could simultaneously reduce portfolio value and constrain the flexibility to meet that requirement. The RM is best placed to assess whether the current positioning remains appropriate given these factors.',

    keyEvidence: [
      'Technology exposure: 27.8% of portfolio',
      'Risk profile: Balanced (Moderate)',
      'Liquidity requirement: S$300,000 within 4 months',
      'Technology −10% prototype scenario impact: approximately CHF −215,000 (−5.1%)',
      'Most affected holdings under scenario: NVIDIA Corporation, TSMC ADR, Apple Inc.',
      'Current liquidity buffer: CHF 420,000',
      'Prototype risk threshold for Balanced mandate: −5.0% (scenario impact exceeds threshold)',
    ],

    talkingPoints: [
      'Review the current technology-sector concentration and whether it remains within the agreed risk parameters for a Balanced mandate',
      'Discuss the portfolio\'s resilience against further technology-sector volatility, referencing the scenario analysis as a preparation tool',
      'Consider the implications of the near-term S$300,000 liquidity requirement alongside the current cash buffer of CHF 420,000',
      'Confirm whether the existing positioning remains aligned with Catherine\'s stated objectives of preserving long-term wealth and maintaining sufficient liquidity',
    ],

    sources: [
      'Portfolio Holdings (WealthLens mock data)',
      'Client Profile — Catherine Tan (C041)',
      'Scenario Analysis — Technology −10% prototype stress test',
      'Market Intelligence — sig-008',
    ],

    relatedSignals: ['sig-008'],

    prep: [
      'Review Catherine\'s current technology-holding weights against the Balanced mandate guidelines',
      'Run the Technology −10% scenario in Scenario Lab and note the most affected holdings',
      'Confirm the current liquidity position against the S$300,000 requirement timeline',
      'Prepare two or three discussion options rather than recommendations — the decision rests with the client',
    ],
  },
]
