import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  ArrowRight,
  Sparkles,
  Info,
  BookOpen,
  AlertCircle,
} from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import { getBriefings, getIntelligence } from '../services/dataService.js'
import { formatDateTime, initialsOf } from '../utils/format.js'

export default function Briefings() {
  const [briefings, setBriefings] = useState(null)
  const [signals,   setSignals]   = useState([])
  const [activeId,  setActiveId]  = useState(null)

  useEffect(() => {
    getBriefings().then((bs) => {
      const sorted = [...bs].sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
      setBriefings(sorted)
      setActiveId(sorted[0]?.id)
    })
    getIntelligence().then(setSignals)
  }, [])

  if (!briefings) return <Loading label="Assembling briefings" />

  const active = briefings.find((b) => b.id === activeId)
  const relatedSignals = active
    ? signals.filter((s) => active.relatedSignals.includes(s.id))
    : []

  // A briefing is "enhanced" when it carries the extended intelligence-brief
  // fields added for Page 7. Older briefings fall back to the original layout.
  const isEnhanced = !!(active?.situation)

  return (
    <div>
      <PageHeader
        eyebrow="Briefings"
        title="Walk in prepared"
        subtitle="Each briefing packages the intelligence behind a meeting into talking points and a prep checklist, so nothing material is left to memory."
      />

      <div className="grid" style={{ gridTemplateColumns: '360px 1fr', alignItems: 'start' }}>

        {/* ── List (unchanged) ── */}
        <Card>
          <div className="card-head">
            <h3>Scheduled</h3>
            <span className="muted" style={{ fontSize: 12.5 }}>{briefings.length} meetings</span>
          </div>
          <div>
            {briefings.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveId(b.id)}
                className="briefing-item"
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: b.id === activeId ? 'var(--surface-2)' : 'transparent',
                  borderLeft: b.id === activeId ? '3px solid var(--gold)' : '3px solid transparent',
                }}
              >
                <div className="row between">
                  <span className="row" style={{ gap: 10 }}>
                    <span className="avatar-lg" style={{ width: 38, height: 38, fontSize: 13 }}>
                      {initialsOf(b.clientName)}
                    </span>
                    <span>
                      <span style={{ fontWeight: 600, fontSize: 14, display: 'block' }}>{b.clientName}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{b.meetingType}</span>
                    </span>
                  </span>
                  <Badge tone={b.status === 'Ready' ? 'low' : 'medium'}>{b.status}</Badge>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                  <CalendarClock size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                  {formatDateTime(b.scheduledFor)}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* ── Detail ── */}
        {active && (
          <div className="grid" style={{ gap: 20 }}>

            {/* Header card — identical for all briefings */}
            <Card className="card-pad">
              <div className="row between wrap" style={{ marginBottom: 6 }}>
                <div className="eyebrow">{active.meetingType}</div>
                <div className="row" style={{ gap: 8 }}>
                  {isEnhanced && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--gold)',
                      background: 'var(--gold-tint)',
                      border: '1px solid var(--gold-tint)',
                      borderRadius: 30,
                      padding: '2px 9px',
                    }}>
                      Intelligence brief
                    </span>
                  )}
                  <Badge tone={active.status === 'Ready' ? 'low' : 'medium'}>{active.status}</Badge>
                </div>
              </div>
              <h2 className="serif" style={{ fontSize: 22 }}>{active.clientName}</h2>
              <div className="muted" style={{ marginTop: 4 }}>
                <CalendarClock size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                {formatDateTime(active.scheduledFor)}
              </div>
              <p className="soft" style={{ marginTop: 14, marginBottom: 0, fontSize: 14.5, lineHeight: 1.6 }}>
                {active.summary}
              </p>
              <div className="row" style={{ gap: 10, marginTop: 18 }}>
                <Link to={`/clients/${active.clientId}`} className="btn btn-primary">
                  Open client <ArrowRight size={15} />
                </Link>
                <button className="btn">
                  <FileText size={15} /> Export briefing
                </button>
              </div>
            </Card>

            {/* ── Enhanced layout — shown when new fields are present ── */}
            {isEnhanced
              ? <IntelligenceBrief briefing={active} />
              : (
                /* ── Legacy layout — original cols-2 grid for older briefings ── */
                <div className="grid cols-2" style={{ alignItems: 'start' }}>
                  <Card className="card-pad">
                    <div className="eyebrow row" style={{ gap: 8, marginBottom: 12 }}>
                      <Sparkles size={14} color="var(--gold)" /> Talking points
                    </div>
                    {active.talkingPoints.map((tp, i) => (
                      <div className="talking-point" key={i}>
                        <span className="n">{String(i + 1).padStart(2, '0')}</span>
                        <span>{tp}</span>
                      </div>
                    ))}
                  </Card>

                  <Card className="card-pad">
                    <div className="eyebrow" style={{ marginBottom: 12 }}>Prep checklist</div>
                    <ul className="checklist">
                      {active.prep.map((p, i) => (
                        <li key={i}>
                          <CheckCircle2 size={16} /> <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )
            }

            {/* ── Related intelligence — shown for all briefings when present ── */}
            {relatedSignals.length > 0 && (
              <Card>
                <div className="card-head"><h3>Intelligence behind this meeting</h3></div>
                <div>
                  {relatedSignals.map((s) => (
                    <div className="briefing-item" key={s.id}>
                      <div className="row between wrap" style={{ gap: 8 }}>
                        <span className="row wrap" style={{ gap: 8 }}>
                          <Badge tone={s.priority}>{s.category}</Badge>
                          <strong style={{ fontSize: 14 }}>{s.headline}</strong>
                        </span>
                      </div>
                      <p className="soft" style={{ fontSize: 13.5, margin: '8px 0 0' }}>{s.why}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// IntelligenceBrief — renders the enhanced brief sections for briefings that
// carry the extended fields (situation, whyItMatters, keyEvidence, sources).
// Each section is individually conditional so partial data never crashes.
// ---------------------------------------------------------------------------
function IntelligenceBrief({ briefing }) {
  return (
    <div className="grid" style={{ gap: 16 }}>

      {/* Situation + Why It Matters — grouped as narrative prose */}
      {(briefing.situation || briefing.whyItMatters) && (
        <Card>
          <div className="card-head">
            <h3 style={{ fontSize: 15 }}>
              <BookOpen size={15} strokeWidth={2} style={{ verticalAlign: -2, marginRight: 8, color: 'var(--gold)' }} />
              Situation
            </h3>
          </div>
          <div className="card-pad" style={{ paddingTop: 16 }}>
            {briefing.situation && (
              <p style={{ margin: '0 0 0', fontSize: 14.5, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.5 }}>
                {briefing.situation}
              </p>
            )}
            {briefing.whyItMatters && (
              <>
                <div className="eyebrow" style={{ margin: '18px 0 8px' }}>Why it matters</div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.65 }}>
                  {briefing.whyItMatters}
                </p>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Key Evidence */}
      {briefing.keyEvidence?.length > 0 && (
        <Card className="card-pad">
          <div className="eyebrow row" style={{ gap: 8, marginBottom: 14 }}>
            <AlertCircle size={14} color="var(--gold)" /> Key evidence
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {briefing.keyEvidence.map((item, i) => (
              <div key={i} className="kv" style={{ alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13.5, color: 'var(--ink-soft)', flex: 1 }}>{item}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Talking Points + Prep — side by side on wider screens */}
      <div className="grid cols-2" style={{ alignItems: 'start' }}>

        {briefing.talkingPoints?.length > 0 && (
          <Card className="card-pad">
            <div className="eyebrow row" style={{ gap: 8, marginBottom: 12 }}>
              <Sparkles size={14} color="var(--gold)" /> Suggested talking points
            </div>
            {briefing.talkingPoints.map((tp, i) => (
              <div className="talking-point" key={i}>
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                <span>{tp}</span>
              </div>
            ))}
          </Card>
        )}

        {briefing.prep?.length > 0 && (
          <Card className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>RM preparation</div>
            <ul className="checklist">
              {briefing.prep.map((p, i) => (
                <li key={i}>
                  <CheckCircle2 size={16} /> <span>{p}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Sources */}
      {briefing.sources?.length > 0 && (
        <Card className="card-pad">
          <div className="eyebrow row" style={{ gap: 8, marginBottom: 12 }}>
            <Info size={13} color="var(--ink-muted)" /> Sources
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {briefing.sources.map((src, i) => (
              <span key={i} className="tag">{src}</span>
            ))}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
            This briefing is a prototype RM preparation aid using mock data. It does not
            constitute investment advice or a buy/sell recommendation. The RM determines
            all client-facing actions.
          </p>
        </Card>
      )}
    </div>
  )
}
