import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  CalendarClock,
  Users,
  Activity,
  AlertTriangle,
  BellOff,
} from 'lucide-react'
import { PageHeader, Card, Loading } from '../components/ui.jsx'
import SignalCard from '../components/SignalCard.jsx'
import {
  getRelationshipManager,
  getIntelligence,
  getBriefings,
  getMarketSnapshot,
  getMarketNarratives,
} from '../services/dataService.js'
import { formatDateTime } from '../utils/format.js'

export default function Overview() {
  const [data, setData] = useState(null)

  useEffect(() => {
    Promise.all([
      getRelationshipManager(),
      getIntelligence(),
      getBriefings(),
      getMarketSnapshot(),
      getMarketNarratives(),
    ]).then(([rm, signals, briefings, market, narratives]) => {
      setData({ rm, signals, briefings, market, narratives })
    })
  }, [])

  if (!data) return <Loading label="Preparing your desk" />

  const { rm, signals, briefings, market, narratives } = data
  const highPriority = signals.filter((s) => s.priority === 'high')
  const prioritySignals = [...signals].sort(byRelevance)
  const upcoming = [...briefings].sort(
    (a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor)
  )

  const kpis = [
    {
      icon: Users,
      value: rm.clientsMonitored,
      label: 'Clients Monitored',
      note: 'Across your book',
    },
    {
      icon: Activity,
      value: rm.marketDevelopmentsAnalysed,
      label: 'Market Developments Analysed',
      note: 'In the last 24 hours',
    },
    {
      icon: AlertTriangle,
      value: highPriority.length,
      label: 'Clients Require Attention',
      note: 'Time-sensitive situations',
      tone: 'high',
    },
    {
      icon: BellOff,
      value: rm.lowRelevanceAlertsSuppressed,
      label: 'Low-Relevance Alerts Suppressed',
      note: 'Noise filtered on your behalf',
      tone: 'muted',
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Tuesday, 1 September 2026"
        title={`Good morning, ${rm.name.split(' ')[0]}`}
        subtitle="Here is what requires your attention today."
      />

      {/* KPI cards */}
      <div className="grid cols-4" style={{ marginBottom: 28 }}>
        {kpis.map((k) => (
          <Card className="kpi" key={k.label}>
            <div className={`kpi-icon${k.tone ? ` kpi-icon-${k.tone}` : ''}`}>
              <k.icon size={18} strokeWidth={2} />
            </div>
            <div className={`kpi-value${k.tone === 'high' ? ' neg' : ''}`}>{k.value}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-note">{k.note}</div>
          </Card>
        ))}
      </div>

      {/* Market strip — deliberately understated */}
      <Card style={{ marginBottom: 28 }}>
        <div className="card-head">
          <h3>Market context</h3>
          <span className="muted" style={{ fontSize: 12.5 }}>
            Shown only to explain client relevance
          </span>
        </div>
        <div className="market-strip">
          {market.map((m) => (
            <div className="market-item" key={m.id}>
              <div className="m-label">{m.label}</div>
              <div className="m-value">{m.value}</div>
              <div className={`m-change ${m.direction === 'up' ? 'pos' : 'neg'}`}>
                {m.direction === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {Math.abs(m.changePct)}%
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: '1.7fr 1fr', alignItems: 'start' }}>
        {/* Priority Intelligence */}
        <div>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 18 }} className="serif">Priority Intelligence</h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
                Ranked by relevance to the client, not by how loud the market is.
              </p>
            </div>
            <Link className="link-gold" to="/intelligence">
              All intelligence <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid" style={{ gap: 18 }}>
            {prioritySignals.slice(0, 4).map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
          </div>
        </div>

        {/* Right rail: upcoming + narratives */}
        <div className="grid" style={{ gap: 20 }}>
          <Card>
            <div className="card-head">
              <h3>Upcoming meetings</h3>
              <Link className="link-gold" to="/briefings">Briefings</Link>
            </div>
            <div>
              {upcoming.slice(0, 4).map((b) => (
                <Link
                  to="/briefings"
                  key={b.id}
                  className="signal-compact"
                  style={{ display: 'block' }}
                >
                  <div className="row between">
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{b.clientName}</span>
                    <span className={`badge badge-${b.status === 'Ready' ? 'low' : 'medium'}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                    <CalendarClock size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                    {formatDateTime(b.scheduledFor)}
                  </div>
                  <div className="soft" style={{ fontSize: 12.5, marginTop: 2 }}>{b.meetingType}</div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Reading the market</div>
            <div className="grid" style={{ gap: 16 }}>
              {narratives.map((n) => (
                <div key={n.id}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
                  <p className="soft" style={{ fontSize: 13, margin: '5px 0 0' }}>{n.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Higher relevance first; fall back to priority ordering.
function byRelevance(a, b) {
  const ar = a.relevanceScore ?? rankToScore(a.priority)
  const br = b.relevanceScore ?? rankToScore(b.priority)
  return br - ar
}
function rankToScore(p) {
  return { high: 80, medium: 55, low: 35 }[p] ?? 0
}
