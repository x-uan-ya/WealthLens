import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  ShieldCheck,
  UserRound,
  Compass,
  Target,
  ArrowRight,
  NotebookPen,
} from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import {
  getOfficialClientById,
  getClientIntelligence,
  getOfficialRm,
} from '../services/dataService.js'
import { initialsOf, formatDate } from '../utils/format.js'

const priorityTone = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low', NONE: 'neutral' }
const priorityLabel = { HIGH: 'High priority', MEDIUM: 'Monitor', LOW: 'Low', NONE: 'No action' }
const severityTone = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' }

export default function ClientDetail() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let active = true
    setState({ loading: true })
    Promise.all([
      getOfficialClientById(id),
      getClientIntelligence(id),
      getOfficialRm(),
    ]).then(([client, intel, rm]) => {
      if (active) setState({ loading: false, client, intel, rm })
    })
    return () => {
      active = false
    }
  }, [id])

  if (state.loading) return <Loading label="Opening client" />
  const { client, intel, rm } = state
  if (!client) {
    return (
      <div>
        <PageHeader title="Client not found" />
        <Link className="link-gold" to="/clients">Back to clients</Link>
      </div>
    )
  }

  const priority = intel?.priority || client.priority || 'NONE'
  // Portfolio / allocation / cash-needs are supplied by the intelligence layer.
  // We render only what exists — nothing is invented in the frontend.
  const allocation = client.allocation || intel?.allocation || null
  const cashNeeds = client.cashNeeds || intel?.cashNeeds || null

  const summary = [
    { icon: ShieldCheck, label: 'Risk Profile', value: client.riskProfile || '—' },
    { icon: Compass, label: 'Life Stage / Context', value: client.lifeStage || '—' },
    { icon: UserRound, label: 'Relationship Manager', value: rm?.name || '—', note: rm?.team },
    {
      icon: Target,
      label: 'Current Priority',
      value: priorityLabel[priority] || priority,
      badge: priority,
    },
  ]

  return (
    <div>
      <Link className="link-gold" to="/clients" style={{ marginBottom: 16, display: 'inline-flex' }}>
        <ArrowLeft size={15} /> All clients
      </Link>

      {/* Header */}
      <div className="detail-head" style={{ marginBottom: 22 }}>
        <div className="avatar-lg" style={{ width: 64, height: 64, fontSize: 21 }}>
          {initialsOf(client.name)}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="page-title" style={{ fontSize: 28 }}>{client.name}</h1>
          <div className="row wrap" style={{ gap: 10, marginTop: 8, alignItems: 'center' }}>
            <span className="mono muted" style={{ fontSize: 13.5 }}>Client {client.id}</span>
            <span className="dot-sep" />
            {client.riskProfile && <Badge tone="gold">{client.riskProfile} Risk</Badge>}
            {client.domicile && (
              <span className="muted" style={{ fontSize: 13 }}>{client.domicile}</span>
            )}
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <Badge tone={priorityTone[priority]}>{priorityLabel[priority] || priority}</Badge>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid cols-4 profile-summary" style={{ marginBottom: 24 }}>
        {summary.map((s) => (
          <Card className="summary-tile" key={s.label}>
            <div className="summary-icon">
              <s.icon size={16} strokeWidth={2} />
            </div>
            <div className="summary-body">
              <div className="summary-label">{s.label}</div>
              <div className="summary-value" style={{ fontSize: 17 }}>{s.value}</div>
              {s.note && <div className="summary-note">{s.note}</div>}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
        <div className="grid" style={{ gap: 20 }}>
          {/* Intelligence signals for this client */}
          <div>
            <div className="row between" style={{ marginBottom: 14 }}>
              <h3 className="serif" style={{ fontSize: 17 }}>Current Intelligence</h3>
              {intel && (
                <Link className="link-gold" to={`/intelligence/${client.id}`}>
                  Full intelligence detail <ArrowRight size={13} />
                </Link>
              )}
            </div>

            {!intel || !intel.signals?.length ? (
              <Card className="empty">
                No intelligence has been generated for this client yet.
              </Card>
            ) : (
              <div className="grid" style={{ gap: 14 }}>
                {intel.signals.map((sig) => (
                  <Card className="card-pad" key={sig.id}>
                    <div className="row between wrap" style={{ gap: 8, marginBottom: 8 }}>
                      <div className="row wrap" style={{ gap: 8 }}>
                        <Badge tone={severityTone[sig.severity] || 'neutral'}>{sig.severity}</Badge>
                        <Badge tone="neutral">{sig.type}</Badge>
                      </div>
                    </div>
                    <h4 style={{ fontSize: 15.5, margin: '0 0 6px' }}>{sig.title}</h4>
                    {sig.summary && (
                      <p className="soft" style={{ fontSize: 13.5, margin: 0 }}>{sig.summary}</p>
                    )}
                    {sig.verifiedMetrics?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        {sig.verifiedMetrics.map((m) => (
                          <div className="kv" key={m.label}>
                            <span className="k">{m.label}</span>
                            <span className="v">{m.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
                <Link className="link-gold" to={`/intelligence/${client.id}`}>
                  Open Why This Client, evidence and history <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>

          {/* Portfolio allocation — only if supplied */}
          <Card className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>Portfolio allocation</div>
            {allocation && allocation.length ? (
              allocation.map((a) => (
                <div className="alloc-row" key={a.label}>
                  <span className="a-label">{a.label}</span>
                  <span className="a-track">
                    <span className="a-fill" style={{ width: `${a.pct}%` }} />
                  </span>
                  <span className="a-pct">{a.pct}%</span>
                </div>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Allocation will appear once the intelligence layer supplies portfolio data.
              </p>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <div className="grid" style={{ gap: 20 }}>
          {/* Objectives / context */}
          {(client.objectives?.length || intel?.relevanceFactors?.length) && (
            <Card className="card-pad">
              <div className="eyebrow row" style={{ marginBottom: 14, gap: 8 }}>
                <Target size={14} /> Objectives &amp; context
              </div>
              {client.objectives?.length ? (
                <ul className="goals">
                  {client.objectives.map((g) => (
                    <li key={g}><span>{g}</span></li>
                  ))}
                </ul>
              ) : (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                  {client.lifeStage || 'Client objectives will appear when supplied.'}
                </p>
              )}
            </Card>
          )}

          {/* Cash needs — only if supplied */}
          {cashNeeds && cashNeeds.length > 0 && (
            <Card className="card-pad">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Cash needs</div>
              {cashNeeds.map((cn, i) => (
                <div className="kv" key={i}>
                  <span className="k">{cn.label || cn.purpose}</span>
                  <span className="v">{cn.value || cn.amount}</span>
                </div>
              ))}
            </Card>
          )}

          {/* RM context */}
          {intel?.rmContext?.length > 0 && (
            <Card className="card-pad">
              <div className="eyebrow row" style={{ marginBottom: 12, gap: 8 }}>
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
    </div>
  )
}
