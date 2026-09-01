import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
} from 'recharts'
import { ArrowLeft, Target, CalendarClock, Phone } from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import SignalCard from '../components/SignalCard.jsx'
import {
  getClientById,
  getPortfolio,
  getIntelligenceForClient,
} from '../services/dataService.js'
import { formatChf, formatPct, initialsOf, formatDate, daysSince } from '../utils/format.js'

export default function ClientDetail() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let active = true
    setState({ loading: true })
    Promise.all([
      getClientById(id),
      getPortfolio(id),
      getIntelligenceForClient(id),
    ]).then(([client, portfolio, signals]) => {
      if (active) setState({ loading: false, client, portfolio, signals })
    })
    return () => {
      active = false
    }
  }, [id])

  if (state.loading) return <Loading label="Opening client" />
  const { client, portfolio, signals } = state
  if (!client) {
    return (
      <div>
        <PageHeader title="Client not found" />
        <Link className="link-gold" to="/clients">Back to clients</Link>
      </div>
    )
  }

  const overdue = daysSince(client.contact.lastContact) > client.contact.cadenceDays

  return (
    <div>
      <Link className="link-gold" to="/clients" style={{ marginBottom: 16, display: 'inline-flex' }}>
        <ArrowLeft size={15} /> All clients
      </Link>

      <div className="detail-head" style={{ marginBottom: 8 }}>
        <div className="avatar-lg" style={{ width: 60, height: 60, fontSize: 20 }}>
          {initialsOf(client.name)}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 className="page-title" style={{ fontSize: 26 }}>{client.name}</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            {client.segment} · {client.domicile} · Client since {client.since}
          </div>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          <Badge tone="gold">{client.relationshipTier}</Badge>
          <Badge tone="neutral">{client.mandate}</Badge>
          <Badge tone="neutral">{client.riskProfile}</Badge>
          {overdue && <Badge tone="medium">Contact due</Badge>}
        </div>
      </div>

      <div className="tags" style={{ marginBottom: 24 }}>
        {client.tags.map((t) => (
          <span className="tag" key={t}>{t}</span>
        ))}
      </div>

      <div className="grid cols-4" style={{ marginBottom: 24 }}>
        <Card className="stat">
          <div className="stat-label">Assets under management</div>
          <div className="stat-value">{formatChf(client.aumChf)}</div>
        </Card>
        <Card className="stat">
          <div className="stat-label">Liquidity</div>
          <div className="stat-value">{formatChf(client.liquidityChf)}</div>
        </Card>
        <Card className="stat">
          <div className="stat-label">YTD return</div>
          <div className="stat-value" style={{ color: client.ytdReturn >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
            {formatPct(client.ytdReturn, { sign: true })}
          </div>
        </Card>
        <Card className="stat">
          <div className="stat-label">Open signals</div>
          <div className="stat-value">{signals.length}</div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
        <div className="grid" style={{ gap: 20 }}>
          {/* Performance */}
          {portfolio && (
            <Card>
              <div className="card-head">
                <h3>Performance vs benchmark</h3>
                <span className="muted" style={{ fontSize: 12.5 }}>Indexed to 100 · 12 months</span>
              </div>
              <div className="card-pad">
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={portfolio.performance} margin={{ left: -18, right: 6, top: 6 }}>
                      <defs>
                        <linearGradient id="pf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0d2a3a" stopOpacity={0.16} />
                          <stop offset="100%" stopColor="#0d2a3a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7a83' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#6b7a83' }} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="portfolio" name="Portfolio" stroke="#0d2a3a" strokeWidth={2.2} fill="url(#pf)" />
                      <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#b3872f" strokeWidth={1.6} strokeDasharray="4 3" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          )}

          {/* Allocation */}
          <Card className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>Asset allocation</div>
            {client.concentration.map((a) => (
              <div className="alloc-row" key={a.label}>
                <span className="a-label">{a.label}</span>
                <span className="a-track">
                  <span className="a-fill" style={{ width: `${a.pct}%` }} />
                </span>
                <span className="a-pct">{a.pct}%</span>
              </div>
            ))}
          </Card>

          {/* Signals for this client */}
          <div>
            <h3 className="serif" style={{ fontSize: 17, margin: '4px 0 14px' }}>
              Intelligence for {client.name.split(' ')[0]}
            </h3>
            {signals.length === 0 ? (
              <Card className="empty">No open signals for this client.</Card>
            ) : (
              <div className="grid" style={{ gap: 16 }}>
                {signals.map((s) => (
                  <SignalCard key={s.id} signal={s} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="grid" style={{ gap: 20 }}>
          <Card className="card-pad">
            <div className="eyebrow row" style={{ marginBottom: 14, gap: 8 }}>
              <Target size={14} /> Objectives
            </div>
            {client.objectives.map((o) => (
              <div className="objective" key={o}>
                <span className="dot" />
                <span>{o}</span>
              </div>
            ))}
          </Card>

          <Card className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>Relationship</div>
            <div className="kv">
              <span className="k">Last contact</span>
              <span className="v">{formatDate(client.contact.lastContact)}</span>
            </div>
            <div className="kv">
              <span className="k">Agreed cadence</span>
              <span className="v">Every {client.contact.cadenceDays} days</span>
            </div>
            <div className="kv">
              <span className="k">Preferred channel</span>
              <span className="v">{client.contact.preferred}</span>
            </div>
            <div className="kv">
              <span className="k">Status</span>
              <span className="v">
                {overdue ? <Badge tone="medium">Overdue</Badge> : <Badge tone="low">On cadence</Badge>}
              </span>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}>
              <Phone size={15} /> Log an interaction
            </button>
          </Card>

          {portfolio && (
            <Card className="card-pad">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Top holdings</div>
              {portfolio.topHoldings.map((h) => (
                <div className="kv" key={h.name}>
                  <span className="k" style={{ maxWidth: 190 }}>{h.name}</span>
                  <span className="v">{h.weight}%</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

const tooltipStyle = {
  border: '1px solid #e6e3dc',
  borderRadius: 10,
  fontSize: 13,
  boxShadow: '0 4px 12px rgba(22,35,43,0.08)',
}
