// Relationship Manager profile used by the app shell (Sidebar / Topbar).
//
// The official RM identity also lives in integrationAdapter.js (officialRm),
// which the RM dashboard consumes via getOfficialRm(). This file keeps the
// shell in sync with the same person. When a real backend exists, both can be
// served from GET /api/me.

export const relationshipManager = {
  id: 'rm-priscilla',
  name: 'Priscilla Ong',
  title: 'Relationship Manager',
  team: 'Julius Baer — Wealth Intelligence',
  location: 'Singapore, SG',
  initials: 'PO',
  email: 'priscilla.ong@juliusbaer.example',
  // 20 official clients monitored by the intelligence engine.
  clientsMonitored: 20,
  clientsManaged: 20,
}
