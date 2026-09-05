import { useState } from 'react'
import {
  FileText,
  Pencil,
  X,
  Check,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  Download,
} from 'lucide-react'
import { downloadBriefPdf } from '../utils/briefExport.js'
import { Card, Badge } from './ui.jsx'
import { EvidenceInspector, EvidenceButton } from './EvidenceInspector.jsx'

// RMBrief — renders a draft brief for human review and provides the
// human-in-the-loop controls: REJECT / EDIT / MARK READY.
//
// The brief is decision support only. Nothing here executes trades or actions;
// the RM edits, rejects, or approves the wording before it is used.
//
// Props:
//   brief    {
//     situation, whyItMatters, clientContext, uncertainty,
//     verifiedEvidence: [ { label, value, source, snapshot } ],
//     discussionPoints: [ string ],
//   }
//   status          'draft' | 'ready' | 'rejected'
//   clientName      optional string for the heading
//   onStatusChange  (nextStatus) => void   // parent persists via the service

const STATUS_BADGE = {
  draft: { tone: 'medium', label: 'Draft — awaiting review' },
  ready: { tone: 'low', label: 'Marked ready' },
  rejected: { tone: 'high', label: 'Rejected' },
  none: { tone: 'neutral', label: 'No brief' },
}

export default function RMBrief({ brief, status = 'draft', clientName, onStatusChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(brief)
  const [showEvidence, setShowEvidence] = useState(false)

  if (!brief) return null

  const badge = STATUS_BADGE[status] || STATUS_BADGE.draft
  const readOnly = !editing

  const handleDownloadPdf = () => {
    const ok = downloadBriefPdf(draft, clientName)
    if (!ok) {
      alert('Please allow pop-ups for this site to download the brief as a PDF.')
    }
  }

  const update = (field, value) => setDraft((d) => ({ ...d, [field]: value }))
  const updatePoint = (i, value) =>
    setDraft((d) => {
      const points = [...(d.discussionPoints || [])]
      points[i] = value
      return { ...d, discussionPoints: points }
    })

  return (
    <Card className="rm-brief">
      <div className="rm-brief-banner">
        <FileText size={15} />
        <span>RM Brief{clientName ? ` — ${clientName}` : ''}</span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <button
          className="btn btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={handleDownloadPdf}
          title="Download this brief as a PDF (print → Save as PDF)"
        >
          <Download size={14} /> Download PDF
        </button>
      </div>

      <div className="card-pad">
        <Section title="Situation">
          <EditableText
            readOnly={readOnly}
            value={draft.situation}
            onChange={(v) => update('situation', v)}
          />
        </Section>

        <Section title="Why it matters">
          <EditableText
            readOnly={readOnly}
            value={draft.whyItMatters}
            onChange={(v) => update('whyItMatters', v)}
          />
        </Section>

        <Section
          title="Verified evidence"
          icon={<ShieldCheck size={14} />}
          action={
            draft.verifiedEvidence?.length > 0 && (
              <EvidenceButton
                count={draft.verifiedEvidence.length}
                onClick={() => setShowEvidence(true)}
                label="Inspect"
              />
            )
          }
        >
          {draft.verifiedEvidence?.map((e, i) => (
            <div className="kv" key={`${e.label}-${i}`}>
              <span className="k">
                {e.label}
                {e.source && (
                  <span className="metric-basis"> — {e.source}{e.snapshot ? ` · ${e.snapshot}` : ''}</span>
                )}
              </span>
              {e.value && <span className="v">{e.value}</span>}
            </div>
          ))}
        </Section>

        <Section title="Client context">
          <EditableText
            readOnly={readOnly}
            value={draft.clientContext}
            onChange={(v) => update('clientContext', v)}
          />
        </Section>

        <Section title="Potential discussion considerations" icon={<MessageSquare size={14} />}>
          <ul className="scenario-list">
            {draft.discussionPoints?.map((p, i) =>
              readOnly ? (
                <li key={i}>{p}</li>
              ) : (
                <li key={i} style={{ paddingLeft: 0 }}>
                  <input
                    className="brief-input"
                    value={p}
                    onChange={(e) => updatePoint(i, e.target.value)}
                  />
                </li>
              )
            )}
          </ul>
        </Section>

        {draft.uncertainty && (
          <div className="uncertainty" style={{ marginTop: 4 }}>
            <AlertCircle size={14} />
            {readOnly ? (
              <span><strong>Uncertainty:</strong> {draft.uncertainty}</span>
            ) : (
              <EditableText
                readOnly={false}
                value={draft.uncertainty}
                onChange={(v) => update('uncertainty', v)}
              />
            )}
          </div>
        )}

        {/* Human-in-the-loop controls */}
        <div className="rm-brief-actions">
          {editing ? (
            <>
              <button className="btn btn-primary btn-sm" onClick={() => setEditing(false)}>
                <Check size={14} /> Done editing
              </button>
              <button
                className="btn btn-sm"
                onClick={() => { setDraft(brief); setEditing(false) }}
              >
                <X size={14} /> Discard changes
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-sm"
                onClick={() => onStatusChange?.('rejected')}
                disabled={status === 'rejected'}
              >
                <X size={14} /> Reject
              </button>
              <button className="btn btn-sm" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Edit
              </button>
              <button
                className={`btn btn-sm ${status === 'ready' ? 'btn-reviewed' : 'btn-primary'}`}
                onClick={() => onStatusChange?.('ready')}
              >
                <Check size={14} /> {status === 'ready' ? 'Ready' : 'Mark ready'}
              </button>
            </>
          )}
          <span className="muted" style={{ fontSize: 11.5, marginLeft: 'auto', maxWidth: 260 }}>
            Decision support only. No action is taken automatically; the RM approves the wording.
          </span>
        </div>
      </div>

      <EvidenceInspector
        open={showEvidence}
        onClose={() => setShowEvidence(false)}
        title="RM brief — verified evidence"
        evidence={draft.verifiedEvidence || []}
      />
    </Card>
  )
}

function Section({ title, icon, action, children }) {
  return (
    <div className="rm-brief-section">
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="eyebrow row" style={{ gap: 7 }}>{icon} {title}</div>
        {action}
      </div>
      {children}
    </div>
  )
}

function EditableText({ readOnly, value, onChange }) {
  if (readOnly) {
    return <p className="reasoning" style={{ margin: 0 }}>{value}</p>
  }
  return (
    <textarea
      className="brief-textarea"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
    />
  )
}
