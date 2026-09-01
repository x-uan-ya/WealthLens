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
]
