import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  ArrowRight,
  Sparkles,
  Info,
  BookOpen,
  AlertCircle,
  Copy,
  CheckCheck,
} from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import { getBriefings, getIntelligence } from '../services/dataService.js'
import { formatDateTime, initialsOf } from '../utils/format.js'

export default function Briefings() {
  const [briefings, setBriefings] = useState(null)
  const [signals,   setSignals]   = useState([])
  const [activeId,  setActiveId]  = useState(null)
  // Local-only status overrides — "Mark Ready" toggles without touching data files.
  const [readyIds,  setReadyIds]  = useState(new Set())
  // Tracks which briefing currently shows "Copied" feedback.
  const [copiedId,  setCopiedId]  = useState(null)
  const copyTimerRef = useRef(null)

  const [searchParams] = useSearchParams()

  useEffect(() => {
    getBriefings().then((bs) => {
      const sorted = [...bs].sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
      setBriefings(sorted)
      // If ?client=<id> is present, open that client's briefing automatically.
      // Falls back to the first briefing if no match is found.
      const clientParam = searchParams.get('client')
      const matched = clientParam
        ? sorted.find((b) => b.clientId === clientParam)
        : null
      setActiveId(matched?.id ?? sorted[0]?.id)
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

  // Derive effective status — local override wins over data-file value.
  const effectiveStatus = (b) =>
    readyIds.has(b.id) ? 'Ready' : b.status

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleMarkReady = () => {
    if (!active) return
    setReadyIds((prev) => new Set([...prev, active.id]))
  }

  const handleExport = () => {
    window.print()
  }

  const handleCopy = () => {
    if (!active) return
    const text = buildBriefText(active)
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(active.id)
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
    })
  }

  return (
    <div>
      {/* ── Print-only styles ── injected only while Briefings page is mounted ── */}
      <style>{PRINT_CSS}</style>

      <PageHeader
        eyebrow="Briefings"
        title="Walk in prepared"
        subtitle="Each briefing packages the intelligence behind a meeting into talking points and a prep checklist, so nothing material is left to memory."
      />

      <div className="grid" style={{ gridTemplateColumns: '360px 1fr', alignItems: 'start' }}>

        {/* ── List (unchanged) ── */}
        <Card data-print="hide">
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
                  <Badge tone={effectiveStatus(b) === 'Ready' ? 'low' : 'medium'}>{effectiveStatus(b)}</Badge>
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
          <div className="grid" style={{ gap: 20 }} data-print="detail">

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
                  <Badge tone={effectiveStatus(active) === 'Ready' ? 'low' : 'medium'}>{effectiveStatus(active)}</Badge>
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
              <div className="row wrap" style={{ gap: 10, marginTop: 18 }} data-print="hide">
                <Link to={`/clients/${active.clientId}`} className="btn btn-primary">
                  Open client <ArrowRight size={15} />
                </Link>
                <button className="btn" onClick={handleExport}>
                  <FileText size={15} /> Export briefing
                </button>
                <button className="btn" onClick={handleCopy}>
                  {copiedId === active.id
                    ? <><CheckCheck size={15} /> Copied</>
                    : <><Copy size={15} /> Copy brief</>
                  }
                </button>
                {effectiveStatus(active) === 'Ready' ? (
                  <span className="btn" style={{ color: 'var(--ok)', borderColor: 'var(--ok)', cursor: 'default', opacity: 0.75 }}>
                    <CheckCheck size={15} /> Ready for discussion
                  </span>
                ) : (
                  <button className="btn" onClick={handleMarkReady}>
                    <CheckCircle2 size={15} /> Mark ready for client discussion
                  </button>
                )}
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
// PRINT_CSS — injected as a <style> element while the Briefings page is
// mounted. Scoped entirely to @media print so the on-screen UI is unaffected.
// ---------------------------------------------------------------------------
const PRINT_CSS = `
@media print {
  /* ── Hide application chrome ── */
  .sidebar,
  .topbar,
  .page-head,
  [data-print="hide"] {
    display: none !important;
  }

  /* ── Reset shell layout so the detail fills the page ── */
  body, #root {
    background: #fff !important;
  }

  .app {
    display: block !important;
  }

  .main {
    display: block !important;
  }

  .content {
    padding: 0 !important;
    max-width: 100% !important;
  }

  /* ── Centre the briefing detail column ── */
  [data-print="detail"] {
    display: block !important;
    width: 100% !important;
    max-width: 820px !important;
    margin: 0 auto !important;
    padding: 24pt 0 !important;
    gap: 0 !important;
  }

  /* The grid wrapper holding list + detail */
  .grid[style] {
    display: block !important;
  }

  /* ── Card print treatment ── */
  .card {
    box-shadow: none !important;
    border: 1px solid #d8d3c8 !important;
    border-radius: 0 !important;
    margin-bottom: 14pt !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  /* ── Single-column for talking points + prep grid ── */
  [data-print="single-col"] {
    display: block !important;
  }

  [data-print="single-col"] > * {
    margin-bottom: 14pt !important;
  }

  /* ── Typography ── */
  body {
    font-size: 11pt !important;
    line-height: 1.5 !important;
    color: #16232b !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  h1, h2, h3, h4 {
    color: #16232b !important;
  }

  .serif {
    font-family: Georgia, "Times New Roman", serif !important;
  }

  .eyebrow {
    font-size: 8pt !important;
    letter-spacing: 0.12em !important;
  }

  /* ── Talking points and checklist spacing ── */
  .talking-point {
    padding: 5pt 0 !important;
    font-size: 11pt !important;
  }

  .checklist li {
    padding: 4pt 0 !important;
    font-size: 11pt !important;
  }

  /* ── Badges: keep colour but remove heavy backgrounds ── */
  .badge {
    border: 1px solid currentColor !important;
    background: transparent !important;
    font-size: 8pt !important;
  }

  /* ── Tags (sources) ── */
  .tag {
    border: 1px solid #d8d3c8 !important;
    font-size: 9pt !important;
  }

  /* ── Links: no underline, keep text colour ── */
  a {
    text-decoration: none !important;
    color: inherit !important;
  }
}
`

// ---------------------------------------------------------------------------
// buildBriefText — assembles a plain-text copy of the active briefing.
// Works for both legacy and enhanced briefings; skips missing sections.
// ---------------------------------------------------------------------------
function buildBriefText(b) {
  const lines = []
  const section = (heading, body) => {
    lines.push(`\n${'─'.repeat(48)}\n${heading.toUpperCase()}\n${'─'.repeat(48)}`)
    lines.push(body)
  }

  lines.push(`CLIENT INTELLIGENCE BRIEF`)
  lines.push(`${b.clientName}  ·  ${b.meetingType}`)
  lines.push(`Status: ${b.status}`)

  if (b.situation)    section('Situation',      b.situation)
  if (b.whyItMatters) section('Why it matters', b.whyItMatters)

  if (b.keyEvidence?.length) {
    section('Key evidence', b.keyEvidence.map((e) => `  • ${e}`).join('\n'))
  }

  if (b.talkingPoints?.length) {
    section('Suggested talking points',
      b.talkingPoints.map((tp, i) => `  ${String(i + 1).padStart(2, '0')}  ${tp}`).join('\n'))
  }

  if (!b.situation && b.summary) {
    section('Summary', b.summary)
  }

  if (b.prep?.length) {
    section('RM preparation',
      b.prep.map((p) => `  ☐  ${p}`).join('\n'))
  }

  if (b.sources?.length) {
    section('Sources', b.sources.map((s) => `  • ${s}`).join('\n'))
  }

  lines.push('\n' + '─'.repeat(48))
  lines.push('This is a prototype RM preparation aid. It does not constitute investment advice.')

  return lines.join('\n')
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
      <div className="grid cols-2" style={{ alignItems: 'start' }} data-print="single-col">

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
