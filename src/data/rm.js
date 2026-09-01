// Mock Relationship Manager profile.
// Replace with GET /api/me when a backend exists.

export const relationshipManager = {
  id: 'rm-001',
  name: 'Sarah Lim',
  title: 'Senior Relationship Manager',
  team: 'UHNW — Singapore Desk',
  location: 'Singapore, SG',
  initials: 'SL',
  email: 'sarah.lim@juliusbaer.example',
  // Book monitored by the intelligence engine on Sarah's behalf.
  clientsMonitored: 128,
  clientsManaged: 128,
  aumChf: 4120000000,
  // Headline figures for the Overview KPIs. Kept here so the value
  // proposition ("we suppress noise") is data-driven, not hardcoded in the UI.
  marketDevelopmentsAnalysed: 26,
  lowRelevanceAlertsSuppressed: 124,
}
