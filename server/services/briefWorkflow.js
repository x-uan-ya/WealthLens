/**
 * briefWorkflow.js
 *
 * Phase 9: RM workflow support — DRAFT / REJECTED / EDITED / READY brief lifecycle.
 *
 * Briefs are stored in-memory for the prototype.
 * Shape: { briefId, clientId, status, aiBrief, editedBrief, rmEdits, history, timestamps }
 *
 * No trade execution. No client-facing output without RM review.
 */

// In-memory store (replace with database persistence in production)
const briefStore = new Map()
let briefCounter = 1

const VALID_STATUSES = ['DRAFT', 'REJECTED', 'EDITED', 'READY']

// ─── Create Brief ──────────────────────────────────────────────────────────────

/**
 * Creates a new brief in DRAFT status.
 * Called after AI generates the brief but before RM review.
 */
export function createBrief({ clientId, clientName, aiBrief, aiBriefInput, signals }) {
  const briefId = `BRIEF-${String(briefCounter++).padStart(4, '0')}`
  const now = new Date().toISOString()

  const brief = {
    briefId,
    clientId,
    clientName,
    status: 'DRAFT',
    aiBrief,           // Original AI-generated content
    editedBrief: null, // RM-edited version (null until EDITED)
    rmEdits: null,     // What the RM changed
    aiBriefInput,      // Verified input that produced the AI brief (audit trail)
    signals: signals || [],
    history: [
      { status: 'DRAFT', timestamp: now, actor: 'system', note: 'AI brief generated' },
    ],
    createdAt: now,
    updatedAt: now,
  }

  briefStore.set(briefId, brief)
  return brief
}

// ─── Get Brief ─────────────────────────────────────────────────────────────────

export function getBrief(briefId) {
  return briefStore.get(briefId) || null
}

export function getBriefsForClient(clientId) {
  return Array.from(briefStore.values())
    .filter(b => b.clientId === clientId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function getAllBriefs() {
  return Array.from(briefStore.values())
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

// ─── Status Transitions ────────────────────────────────────────────────────────

/**
 * Marks a brief as READY for RM use (approved as-is or after editing).
 */
export function approveBrief(briefId, rmId = 'RM-001') {
  const brief = briefStore.get(briefId)
  if (!brief) throw new Error(`Brief ${briefId} not found`)
  if (brief.status === 'READY') return brief  // Already ready

  const now = new Date().toISOString()
  brief.status = 'READY'
  brief.updatedAt = now
  brief.history.push({
    status: 'READY',
    timestamp: now,
    actor: rmId,
    note: 'RM approved brief',
  })
  return brief
}

/**
 * Marks a brief as REJECTED.
 */
export function rejectBrief(briefId, rmId = 'RM-001', reason = '') {
  const brief = briefStore.get(briefId)
  if (!brief) throw new Error(`Brief ${briefId} not found`)

  const now = new Date().toISOString()
  brief.status = 'REJECTED'
  brief.updatedAt = now
  brief.history.push({
    status: 'REJECTED',
    timestamp: now,
    actor: rmId,
    note: reason || 'RM rejected brief',
  })
  return brief
}

/**
 * RM edits the brief content. Brief moves to EDITED status.
 * The original AI brief is preserved for audit.
 *
 * @param {string} briefId
 * @param {object} editedContent - Partial or full override of aiBrief fields
 * @param {string} rmId
 */
export function editBrief(briefId, editedContent, rmId = 'RM-001') {
  const brief = briefStore.get(briefId)
  if (!brief) throw new Error(`Brief ${briefId} not found`)
  if (brief.status === 'REJECTED') throw new Error('Cannot edit a rejected brief')

  const now = new Date().toISOString()

  // Record what was changed
  const rmEdits = {}
  for (const key of Object.keys(editedContent)) {
    if (brief.aiBrief?.[key] !== editedContent[key]) {
      rmEdits[key] = {
        original: brief.aiBrief?.[key],
        edited: editedContent[key],
      }
    }
  }

  brief.editedBrief = { ...(brief.aiBrief || {}), ...editedContent }
  brief.rmEdits = rmEdits
  brief.status = 'EDITED'
  brief.updatedAt = now
  brief.history.push({
    status: 'EDITED',
    timestamp: now,
    actor: rmId,
    editedFields: Object.keys(rmEdits),
    note: 'RM edited brief',
  })
  return brief
}

/**
 * Returns the active (best available) content of a brief:
 * - EDITED: return editedBrief
 * - READY: return editedBrief if edited, else aiBrief
 * - DRAFT: return aiBrief
 * - REJECTED: return null
 */
export function getActiveBriefContent(briefId) {
  const brief = briefStore.get(briefId)
  if (!brief) return null
  if (brief.status === 'REJECTED') return null
  if (brief.editedBrief) return { ...brief.editedBrief, _source: 'rm_edited' }
  return { ...brief.aiBrief, _source: 'ai_generated' }
}

// ─── List helpers ──────────────────────────────────────────────────────────────

export function getBriefsByStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status. Valid values: ${VALID_STATUSES.join(', ')}`)
  }
  return Array.from(briefStore.values()).filter(b => b.status === status)
}
