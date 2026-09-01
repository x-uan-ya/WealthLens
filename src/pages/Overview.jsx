import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, ArrowDownRight, CalendarClock } from 'lucide-react'
import { PageHeader, Card, Stat, Loading } from '../components/ui.jsx'
import SignalCard from '../components/SignalCard.jsx'
import {
  getRelationshipManager,
  getClients,
  getIntelligence,
  getBriefings,
  getMarketSnapshot,
  getMarketNarratives,
} from '../services/dataService.js'
import { formatChf, formatDateTime } from '../utils/format.js'

export default function Overview() {
  const [data, setData] = useState(null)

  useEffect(() => {
    Promise.all([
      getRelationshipManager(),
      getClients(),
      getIntelligence(),
      getBriefings(),
      getMarketSnapshot(),
      getMarketNarratives(),
    ]).then(([rm, clients, signals, briefings, market, narratives]) => {
      setData({ rm, clients, signals, briefings, market, narratives })
    })
  }, [])

  if (!data) return <Loading label="Preparing your desk" />

  const { rm, clients, signals, briefings, market, narratives } = data
  const highPriority = signals.filter((s) => s.priority === 'high')
  const topSignals = [...signals]
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .slice(0, 3)
  const totalAum = clients.reduce((sum, c) => sum + c.aumChf, 0)
  const upcoming = [...briefings].sort(
    (a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor)
  )

  return (
    <div>
      <PageHeader
        eyebrow="Tuesday, 1 September 2026"
        title={`Good morning, ${rm.name.split(' ')[0]}`}
        subtitle="Here is what needs your attention today, ordered by what matters most to your clients."
      />

      {/* Hero: the value proposition, stated plainly */}
      <div className="hero" style={{ marginBottom: 24 }}>
        <div className="hero-eyebrow">Today&rsquo;s focus</div>
        <h2>
          {highPriority.length} client {highPriority.length === 1 ? 'situation' : 'situations'} need
          a decision from you. Not {signals.length} alerts to triage.
        </h2>
        <p>
          WealthLens reads market and portfolio movement, then surfaces only what is material to a
          specific client, and explains why.
        </p>
        <div className="hero-stats">
          <div className="hero-stat">
            <div className="n">{clients.length}</div>
            <div className="l">Active relationships</div>
          </div>
          <div className="hero-stat">
            <div className="n">{signals.length}</div>
            <div className="l">Signals reviewed</div>
          </div>
          <div className="hero-stat">
            <div className="n">{highPriority.length}</div>
            <div className="l">Need action now</div>
          </div>
          <div className="hero-stat">
            <div className="n">{upcoming.length}</div>
            <div className="l">Meetings prepared</div>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid cols-4" style={{ marginBottom: 24 }}>
        <Stat label="Book under management" value={formatChf(totalAum)} foot="across your clients" />
        <Stat label="High-priority situations" value={highPriority.length} deltaTone="neg" delta="Act this week" />
        <Stat label="Weighted YTD return" value={weightedReturn(clients)} deltaTone="pos" delta="vs benchmark" />
        <Stat label="Briefings ready" value={`${briefings.filter((b) => b.status === 'Ready').length}/${briefings.length}`} foot="for upcoming meetings" />
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
        {/* Priority signals */}
        <div>
          <div className="row between" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 17 }} className="serif">What matters most today</h3>
            <Link className="link-gold" to="/intelligence">
              All intelligence <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid" style={{ gap: 18 }}>
            {topSignals.map((s) => (
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

function priorityRank(p) {
  return { high: 0, medium: 1, low: 2 }[p] ?? 3
}

function weightedReturn(clients) {
  const totalAum = clients.reduce((s, c) => s + c.aumChf, 0)
  const w = clients.reduce((s, c) => s + c.ytdReturn * c.aumChf, 0) / totalAum
  return `+${w.toFixed(1)}%`
}
