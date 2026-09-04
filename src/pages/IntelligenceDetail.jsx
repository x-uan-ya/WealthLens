import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ShieldAlert, NotebookPen, ListTree, AlertCircle, FlaskConical, FileText } from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import WhyThisClient from '../components/WhyThisClient.jsx'
import SnapshotTimeline from '../components/SnapshotTimeline.jsx'
import AlignmentMonitor from '../components/AlignmentMonitor.jsx'
import RMBrief from '../components/RMBrief.jsx'
import { EvidenceInspector, EvidenceButton } from '../components/EvidenceInspector.jsx'
import {
  getClientIntelligence,
  getOfficialClientById,
  getClientBrief,
  generateClientBrief,
  getBriefStatus,
  setBriefStatus,
} from '../services/dataService.js'
import { formatDate } from '../utils/format.js'

const priorityTone = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low', NONE: 'neutral' }
const priorityLabel = { HIGH: 'High priority', MEDIUM: 'Monitor', LOW: 'Low', NONE: 'No action' }
const severityTone = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' }

const humanType = (t = '') =>
  t.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export default function IntelligenceDetail() {
  // The route param is a CLIENT id (e.g. CL-0014).
  const { id } = useParams()
  const [state, setState] = useState({ loading: true })
  const [evidence, setEvidence] = useState(null) // { title, items } | null
  const [brief, setBrief] = useState(null)
  const [briefStatus, setBriefStatusState] = useState('none')
  const [briefOpen, setBriefOpen] = useState(false)

  useEffect(() => {
    let active = true
    setState({ loading: true })
    Promise.all([
      getClientIntelligence(id),
      getOfficialClientById(id),
      getClientBrief(id),
      getBriefStatus(id),
    ]).then(([intel, client, briefObj, status]) => {
      if (!active) return
      setState({ loading: false, intel, client })
      setBrief(briefObj)
      setBriefStatusState(status)
      setBriefOpen(status === 'ready') // auto-show an already-approved brief
    })
    return () => {
      active = false
    }
  }, [id])

  const changeBriefStatus = (next) => {
    setBriefStatus(id, next).then(() => setBriefStatusState(next))
  }

  // Generate the grounded AI brief on demand (server-side OpenAI). Falls back
  // to the pending marker if the AI service is unavailable so the panel still
  // opens rather than silently doing nothing.
  const [briefLoading, setBriefLoading] = useState(false)
  const handleGenerateBrief = () => {
    setBriefLoading(true)
    generateClientBrief(id).then((generated) => {
      if (generated) setBrief(generated)
      setBriefOpen(true)
      setBriefLoading(false)
    })
  }

  if (state.loading) return <Loading label="Opening intelligence" />
  const { intel, client } = state

  if (!intel) {
    return (
      <div>
        <Link className="link-gold" to="/intelligence" style={{ display: 'inline-flex', marginBottom: 16 }}>
          <ArrowLeft size={15} /> All intelligence
        </Link>
        <Card className="empty">No intelligence has been generated for this client yet.</Card>
      </div>
    )
  }

  const name = client?.name || intel.clientId
  const priority = intel.priority || 'NONE'

  // Alignment signal (mandate breach / objective contradiction) drives the
  // Client Alignment Monitor. Context rows are drawn from other signals'
  // headline metrics + client life stage, so the monitor explains why the
  // misalignment matters beyond the breach itself.
  const alignmentSignal = (intel.signals || []).find((s) =>
    ['MANDATE_BREACH', 'OBJECTIVE_CONTRADICTION'].includes(s.type)
  )
  const alignmentContext = []
  if (alignmentSignal) {
    for (const s of intel.signals) {
      if (s === alignmentSignal) continue
      const m = s.verifiedMetrics?.[0]
      if (m) alignmentContext.push({ label: s.title, value: m.value })
    }
    if (client?.lifeStage) alignmentContext.push({ label: 'Life context', value: client.lifeStage })
  }

  return (
    <div>
      <Link className="link-gold" to={`/clients/${intel.clientId}`} style={{ display: 'inline-flex', marginBottom: 16 }}>
        <ArrowLeft size={15} /> {name}
      </Link>

      <PageHeader
        eyebrow={`Intelligence · ${intel.clientId}`}
        title={name}
        subtitle={client?.lifeStage}
        actions={<Badge tone={priorityTone[priority]}>{priorityLabel[priority] || priority}</Badge>}
      />

      <div className="grid" style={{ gridTemplateColumns: '1.5fr 1fr', alignItems: 'start' }}>
        {/* Left: alignment monitor (if applicable) + signals + history */}
        <div className="grid" style={{ gap: 20 }}>
          {alignmentSignal && (
            <AlignmentMonitor
              signal={alignmentSignal}
              client={client}
              context={alignmentContext}
            />
          )}

          {/* Signals */}
          <div>
            <h3 className="serif" style={{ fontSize: 17, margin: '0 0 14px' }}>Signals</h3>
            <div className="grid" style={{ gap: 14 }}>
              {(intel.signals || []).map((sig) => (
                <Card className="card-pad" key={sig.id}>
                  <div className="row between wrap" style={{ gap: 8, marginBottom: 8 }}>
                    <div className="row wrap" style={{ gap: 8 }}>
                      <Badge tone={severityTone[sig.severity] || 'neutral'}>{sig.severity}</Badge>
                      <Badge tone="neutral">{humanType(sig.type)}</Badge>
                    </div>
                    {sig.evidence?.length > 0 && (
                      <EvidenceButton
                        count={sig.evidence.length}
                        onClick={() => setEvidence({ title: sig.title, items: sig.evidence })}
                      />
                    )}
                  </div>

                  <h4 style={{ fontSize: 16, margin: '0 0 6px' }}>
                    <ShieldAlert size={15} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--danger)' }} />
                    {sig.title}
                  </h4>
                  {sig.summary && (
                    <p className="soft" style={{ fontSize: 13.5, margin: '0 0 12px' }}>{sig.summary}</p>
                  )}

                  {/* Verified metrics */}
                  {sig.verifiedMetrics?.length > 0 && (
                    <div className="verified-metrics">
                      <div className="eyebrow" style={{ marginBottom: 8 }}>Verified metrics</div>
                      {sig.verifiedMetrics.map((m) => (
                        <div className="kv" key={m.label}>
                          <span className="k">
                            {m.label}
                            {m.basis && <span className="metric-basis"> — {m.basis}</span>}
                          </span>
                          <span className="v">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Uncertainty — explicit, never hidden */}
                  {sig.uncertainty && (
                    <div className="uncertainty">
                      <AlertCircle size={14} />
                      <span><strong>Uncertainty:</strong> {sig.uncertainty}</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* RM Brief — generated draft for human review */}
          {brief && (
            briefOpen ? (
              <>
                <RMBrief
                  brief={brief}
                  status={briefStatus}
                  clientName={name}
                  onStatusChange={changeBriefStatus}
                />
                {briefStatus === 'ready' && (
                  <Card className="card-pad">
                    <div className="row between wrap" style={{ gap: 12 }}>
                      <div className="soft" style={{ fontSize: 13.5 }}>
                        Brief approved. A simplified client-facing version is now available.
                      </div>
                      <a
                        className="btn btn-sm"
                        href={`/client-view/${intel.clientId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={14} /> Open client view
                      </a>
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <Card className="card-pad">
                <div className="row between wrap" style={{ gap: 12 }}>
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 4 }}>RM Brief</div>
                    <div className="soft" style={{ fontSize: 13.5 }}>
                      Generate a structured brief for your review. You edit, reject or mark it ready.
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleGenerateBrief} disabled={briefLoading}>
                    <FileText size={14} /> {briefLoading ? 'Generating…' : 'Generate RM Brief'}
                  </button>
                </div>
              </Card>
            )
          )}

          {/* Scenario link — when the engine has attached stress tests */}
          {intel.scenarios?.length > 0 && (
            <Card className="card-pad">
              <div className="row between wrap" style={{ gap: 12 }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>Scenario / stress test</div>
                  <div className="soft" style={{ fontSize: 13.5 }}>
                    {intel.scenarios.length === 1
                      ? intel.scenarios[0].name
                      : `${intel.scenarios.length} scenarios available`} — not a forecast.
                  </div>
                </div>
                <Link className="btn btn-primary btn-sm" to={`/scenario-lab?client=${intel.clientId}`}>
                  <FlaskConical size={14} /> Open in Scenario Lab
                </Link>
              </div>
            </Card>
          )}

          {/* Historical changes */}
          {intel.snapshotHistory && (
            <SnapshotTimeline history={intel.snapshotHistory} title="How this changed over time" />
          )}
        </div>

        {/* Right: why this client + priority breakdown + rm context */}
        <div className="grid" style={{ gap: 20 }}>
          <WhyThisClient intelligence={intel} client={client} />

          {/* Priority breakdown — documented components, not a magic number */}
          {intel.priorityBreakdown?.length > 0 && (
            <Card className="card-pad">
              <div className="eyebrow row" style={{ gap: 8, marginBottom: 4 }}>
                <ListTree size={14} /> Why this priority?
              </div>
              <div className="row between" style={{ margin: '10px 0 12px' }}>
                <span className="muted" style={{ fontSize: 13 }}>Priority score</span>
                <span className="impact-figure" style={{ fontSize: 26 }}>{intel.priorityScore}</span>
              </div>
              {intel.priorityBreakdown.map((b) => (
                <div className="kv" key={b.label}>
                  <span className="k">{b.label}</span>
                  <span className="v">+{b.points}</span>
                </div>
              ))}
            </Card>
          )}

          {/* RM context */}
          {intel.rmContext?.length > 0 && (
            <Card className="card-pad">
              <div className="eyebrow row" style={{ gap: 8, marginBottom: 12 }}>
                <NotebookPen size={14} /> RM context
              </div>
              <div className="grid" style={{ gap: 12 }}>
                {intel.rmContext.map((n, i) => (
                  <div key={i}>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {formatDate(n.date)}{n.author ? ` · ${n.author}` : ''}
                    </div>
                    <p className="soft" style={{ fontSize: 13, margin: '3px 0 0' }}>{n.note}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Evidence drawer */}
      <EvidenceInspector
        open={Boolean(evidence)}
        onClose={() => setEvidence(null)}
        title={evidence?.title}
        evidence={evidence?.items || []}
      />
    </div>
  )
}
