// Generic mock preferences (settings).
//
// This is deliberately generic: there is NO challenge-specific alert logic,
// no real-time feed configuration, no trading rules, and no investment
// recommendations here. It is a plain, data-driven settings model that the
// UI renders dynamically, so the whole thing can be swapped once official
// requirements are released.
//
// Two parts:
//   1. `preferenceSchema` — describes the sections and controls to render.
//   2. `defaultPreferences` — the current values, keyed by control id.
//
// Control types the UI understands: 'toggle', 'select', 'radio'.
// A real backend can return the same two shapes from an endpoint.

export const preferenceSchema = [
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Choose which updates you receive and how they are delivered.',
    controls: [
      {
        id: 'notify.intelligence',
        type: 'toggle',
        label: 'Intelligence updates',
        help: 'Be notified when new intelligence is prepared for your clients.',
      },
      {
        id: 'notify.meetings',
        type: 'toggle',
        label: 'Meeting reminders',
        help: 'Reminders ahead of scheduled client meetings.',
      },
      {
        id: 'notify.relationship',
        type: 'toggle',
        label: 'Relationship prompts',
        help: 'Prompts when a client contact cadence is due.',
      },
      {
        id: 'notify.digest',
        type: 'select',
        label: 'Summary digest',
        help: 'How often you receive a rolled-up summary.',
        options: [
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'off', label: 'Off' },
        ],
      },
      {
        id: 'notify.channel',
        type: 'radio',
        label: 'Delivery channel',
        help: 'Where notifications are delivered.',
        options: [
          { value: 'in-app', label: 'In app' },
          { value: 'email', label: 'Email' },
          { value: 'both', label: 'Both' },
        ],
      },
    ],
  },
  {
    id: 'portfolio',
    title: 'Portfolio preferences',
    description:
      'Generic display preferences for portfolio views. These affect presentation only and carry no investment logic.',
    controls: [
      {
        id: 'portfolio.baseCurrency',
        type: 'select',
        label: 'Base currency',
        help: 'Currency used to present portfolio figures.',
        options: [
          { value: 'SGD', label: 'SGD (S$)' },
          { value: 'CHF', label: 'CHF' },
          { value: 'USD', label: 'USD ($)' },
          { value: 'EUR', label: 'EUR (\u20ac)' },
        ],
      },
      {
        id: 'portfolio.performanceWindow',
        type: 'select',
        label: 'Default performance window',
        help: 'The time range shown first on performance charts.',
        options: [
          { value: '3m', label: '3 months' },
          { value: '6m', label: '6 months' },
          { value: '12m', label: '12 months' },
          { value: 'ytd', label: 'Year to date' },
        ],
      },
      {
        id: 'portfolio.benchmark',
        type: 'toggle',
        label: 'Show benchmark comparison',
        help: 'Overlay a benchmark line on performance charts.',
      },
      {
        id: 'portfolio.valueDisplay',
        type: 'radio',
        label: 'Value display',
        help: 'How large monetary values are formatted.',
        options: [
          { value: 'compact', label: 'Compact (S$4.2m)' },
          { value: 'full', label: 'Full (S$4,200,000)' },
        ],
      },
    ],
  },
]

export const defaultPreferences = {
  'notify.intelligence': true,
  'notify.meetings': true,
  'notify.relationship': true,
  'notify.digest': 'weekly',
  'notify.channel': 'in-app',
  'portfolio.baseCurrency': 'SGD',
  'portfolio.performanceWindow': '12m',
  'portfolio.benchmark': true,
  'portfolio.valueDisplay': 'compact',
}
