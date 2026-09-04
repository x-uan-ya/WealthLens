// Relationship Manager identity used by the app shell (Sidebar / Topbar) as a
// synchronous fallback so the chrome renders instantly on first paint.
//
// The authoritative RM profile is served by the intelligence engine at
// GET /api/rm and consumed by the dashboard via getOfficialRm(). The values
// below mirror that record. No fabricated financial figures are stored here.

export const relationshipManager = {
  id: 'RM-001',
  name: 'Priscilla Ong',
  title: 'Senior Relationship Manager',
  team: 'UHNW — Asia Pacific Desk',
  location: 'Hong Kong',
  initials: 'PO',
  // 20 official clients monitored by the intelligence engine.
  clientsMonitored: 20,
  clientsManaged: 20,
}
