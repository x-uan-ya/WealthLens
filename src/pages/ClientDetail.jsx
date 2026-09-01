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
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  ArrowLeft,
  Target,
  Phone,
  Wallet,
  TrendingUp,
  Coins,
  ShieldCheck,
  Clock,
  Droplets,
  UserRound,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import SignalCard from '../components/SignalCard.jsx'
import {
  getClientById,
  getPortfolio,
  getIntelligenceForClient,
  getRelationshipManager,
} from '../services/dataService.js'
import { formatChf, formatPct, initialsOf, formatDate, timeAgo, daysSince } from '../utils/format.js'

// Fold detailed allocation labels into the four headline buckets.
const BUCKET_MAP = {
  Equities: 'Equities',
  'Fixed income': 'Fixed Income',
  Cash: 'Cash',
  'Real estate': 'Alternatives',
  'Private markets': 'Alternatives',
  Derivatives: 'Alternatives',
  Alternatives: 'Alternatives',
}
const BUCKET_ORDER = ['Equities', 'Fixed Income', 'Cash', 'Alternatives']
const BUCKET_COLORS = {
  Equities: '#0d2a3a',
  'Fixed Income': '#3a6070',
  Cash: '#cdd8dd',
  Alternatives: '#b3872f',
}

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
      getRelationshipManager(),
    ]).then(([client, portfolio, signals, rm]) => {
      if (active) setState({ loading: false, client, portfolio, signals, rm })
    })
    return () => {
      active = false
    }
  }, [id])

  if (state.loading) return <Loading label="Opening client" />
  const { client, portfolio, signals, rm } = state
  if (!client) {
    return (
      <div>
        <PageHeader title="Client not found" />
        <Link className="link-gold" to="/clients">Back to clients</Link>
      </div>
    )
  }

  const overdue = daysSince(client.contact.lastContact) > client.contact.cadenceDays

  // Allocation folded into four buckets for the donut.
  const buckets = {}
  for (const a of client.concentration) {
    const b = BUCKET_MAP[a.label] || 'Alternatives'
    buckets[b] = (buckets[b] || 0) + a.pct
  }
  const allocation = BUCKET_ORDER.filter((b) => buckets[b]).map((b) => ({
    label: b,
    pct: buckets[b],
  }))

  const cashPct = buckets['Cash'] || 0

  // Highest-priority signal for the Current Intelligence section.
  const topSignal = [...signals].sort(
    (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)
  )[0]

  const lr = client.liquidityRequirement

  const summary = [
    {
      icon: Wallet,
      label: 'Total Portfolio Value',
      value: formatChf(client.aumChf),
    },
    {
      icon: TrendingUp,
      label: 'YTD Performance',
      value: formatPct(client.ytdReturn, { sign: true }),
      tone: client.ytdReturn >= 0 ? 'pos' : 'neg',
    },
    {
      icon: Coins,
      label: 'Cash Position',
      value: formatChf(client.liquidityChf),
      note: `${cashPct}% of portfolio`,
    },
    {
      icon: ShieldCheck,
      label: 'Risk Profile',
      value: client.riskProfile,
    },
    {
      icon: Clock,
      label: 'Investment Horizon',
      value: client.investmentHorizonYears ? `${client.investmentHorizonYears} years` : '—',
    },
    {
      icon: Droplets,
      label: 'Liquidity Requirement',
      value: lr ? formatChf(lr.amount) : '—',
      note: lr ? `within ${lr.months} months` : undefined,
    },
    {
      icon: UserRound,
      label: 'Relationship Manager',
      value: rm?.name || '—',
      note: rm?.team,
    },
    {
      icon: CalendarClock,
      label: 'Last Interaction',
      value: timeAgo(client.contact.lastContact),
      note: formatDate(client.contact.lastContact),
      tone: overdue ? 'neg' : undefined,
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
            <span className="mono muted" style={{ fontSize: 13.5 }}>Client {client.clientId}</span>
            <span className="dot-sep" />
            <Badge tone="gold">{client.riskProfile} Risk</Badge>
            <span className="muted" style={{ fontSize: 13 }}>
              {client.segment} · {client.domicile} · Client since {client.since}
            </span>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn">{client.mandate}</button>
          <button className="btn btn-primary">
            <Phone size={15} /> Log interaction
          </button>
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
              <div className={`summary-value${s.tone ? ` ${s.tone}` : ''}`}>{s.value}</div>
              {s.note && <div className="summary-note">{s.note}</div>}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
        <div className="grid" style={{ gap: 20 }}>
          {/* Allocation donut */}
          <Card>
            <div className="card-head">
              <h3>Portfolio allocation</h3>
              <span className="muted" style={{ fontSize: 12.5 }}>By asset class</span>
            </div>
            <div className="card-pad">
              <div className="alloc-donut">
                <div style={{ width: 200, height: 200, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocation}
                        dataKey="pct"
                        nameKey="label"
                        innerRadius={60}
                        outerRadius={92}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {allocation.map((a) => (
                          <Cell key={a.label} fill={BUCKET_COLORS[a.label]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v, n) => [`${v}%`, n]} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="alloc-legend">
                  {allocation.map((a) => (
                    <div className="alloc-row" key={a.label}>
                      <span className="row" style={{ gap: 9, width: 130 }}>
                        <span style={{ width: 11, height: 11, borderRadius: 3, background: BUCKET_COLORS[a.label] }} />
                        {a.label}
                      </span>
                      <span className="a-track">
                        <span className="a-fill" style={{ width: `${a.pct}%`, background: BUCKET_COLORS[a.label] }} />
                      </span>
                      <span className="a-pct">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

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

          {/* Current Intelligence — the single highest-priority item */}
          <div>
            <div className="row between" style={{ marginBottom: 14 }}>
              <h3 className="serif" style={{ fontSize: 17 }}>Current Intelligence</h3>
              {signals.length > 1 && (
                <Link className="link-gold" to="/intelligence">
                  {signals.length - 1} more for this client
                </Link>
              )}
            </div>
            {topSignal ? (
              <SignalCard signal={topSignal} />
            ) : (
              <Card className="empty">No open intelligence for this client.</Card>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="grid" style={{ gap: 20 }}>
          {/* Client Goals */}
          <Card className="card-pad">
            <div className="eyebrow row" style={{ marginBottom: 14, gap: 8 }}>
              <Target size={14} /> Client Goals
            </div>
            <ul className="goals">
              {(client.goals || client.objectives).map((g) => (
                <li key={g}>
                  <CheckCircle2 size={16} />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Relationship */}
          <Card className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 14 }}>Relationship</div>
            <div className="kv">
              <span className="k">Manager</span>
              <span className="v">{rm?.name}</span>
            </div>
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
