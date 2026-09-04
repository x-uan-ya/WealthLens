// Generic mock notifications.
//
// These are intentionally generic and free of challenge-specific alert logic.
// They exist to demonstrate a notification surface that is fully data-driven,
// so it can be replaced once official requirements define real event types.
//
// Shape (kept simple and API-ready):
//   id       string
//   type     'intelligence' | 'meeting' | 'client' | 'system'  (display grouping only)
//   title    string
//   body     string
//   time     ISO timestamp
//   read     boolean
//   link     optional in-app route the notification points to

export const notifications = [
  {
    id: 'ntf-001',
    type: 'intelligence',
    title: 'New high-priority intelligence',
    body: 'A situation for Lau Chi Ming has been flagged for your review.',
    time: '2026-09-01T07:40:00',
    read: false,
    link: '/intelligence/CL-0014',
  },
  {
    id: 'ntf-002',
    type: 'intelligence',
    title: 'Client alignment issue detected',
    body: 'Margarethe Voss-Brenner\u2019s allocation is outside the mandate range.',
    time: '2026-09-01T07:10:00',
    read: false,
    link: '/intelligence/CL-0003',
  },
  {
    id: 'ntf-003',
    type: 'client',
    title: 'Objective vs portfolio mismatch',
    body: 'Abdullah Al-Mansoori\u2019s exposure differs from his stated objective.',
    time: '2026-08-31T16:20:00',
    read: false,
    link: '/intelligence/CL-0019',
  },
  {
    id: 'ntf-004',
    type: 'intelligence',
    title: 'Weekly intelligence digest ready',
    body: 'Your prioritised summary across the book has been prepared.',
    time: '2026-08-31T08:00:00',
    read: true,
    link: '/intelligence',
  },
  {
    id: 'ntf-005',
    type: 'system',
    title: 'Preferences saved',
    body: 'Your notification and portfolio preferences were updated.',
    time: '2026-08-30T11:05:00',
    read: true,
    link: '/settings',
  },
]
