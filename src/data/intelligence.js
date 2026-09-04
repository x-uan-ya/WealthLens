// Legacy prototype intelligence signals (Catherine Tan / Sarah-era mock).
//
// EMPTIED during backend integration. The official flow now sources all
// intelligence from the real engine at /api/clients/:id/intelligence via
// dataService's getClientIntelligence(). Nothing fabricated is served here.
// Kept as an empty export only so legacy pages that still import it build.

export const intelligenceSignals = []
