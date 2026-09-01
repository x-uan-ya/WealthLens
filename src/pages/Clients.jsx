import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import { getClients, getIntelligence } from '../services/dataService.js'
import { formatChf, formatPct, initialsOf, daysSince } from '../utils/format.js'

const SEGMENTS = ['All', 'UHNW', 'HNW']

export default function Clients() {
  const [clients, setClients] = useState(null)
  const [signals, setSignals] = useState([])
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('All')

  useEffect(() => {
    getClients().then(setClients)
    getIntelligence().then(setSignals)
  }, [])

  const signalCountByClient = useMemo(() => {
    const map = {}
    for (const s of signals) {
      map[s.clientId] = map[s.clientId] || { total: 0, high: 0 }
      map[s.clientId].total += 1
      if (s.priority === 'high') map[s.clientId].high += 1
    }
    return map
  }, [signals])

  const filtered = useMemo(() => {
    if (!clients) return []
    return clients
      .filter((c) => (segment === 'All' ? true : c.segment === segment))
      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
  }, [clients, query, segment])

  if (!clients) return <Loading label="Loading client book" />

  return (
    <div>
      <PageHeader
        eyebrow="Clients"
        title="Your relationships"
        subtitle="A focused book of high and ultra-high net worth clients. Cards flag where intelligence is waiting."
      />

      <Card className="card-pad" style={{ marginBottom: 24 }}>
        <div className="row between wrap" style={{ gap: 16 }}>
          <div className="search" style={{ maxWidth: 340, margin: 0 }}>
            <Search size={16} />
            <input
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="row" style={{ gap: 8 }}>
            {SEGMENTS.map((s) => (
              <button
                key={s}
                className={`chip${segment === s ? ' active' : ''}`}
                onClick={() => setSegment(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="empty">No clients match your search.</Card>
      ) : (
        <div className="grid cols-3">
          {filtered.map((c) => {
            const sc = signalCountByClient[c.id]
            const overdue = daysSince(c.contact.lastContact) > c.contact.cadenceDays
            return (
              <Link to={`/clients/${c.id}`} key={c.id} className="card client-card">
                <div className="cc-top">
                  <div className="avatar-lg">{initialsOf(c.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cc-name">{c.name}</div>
                    <div className="cc-meta">
                      {c.segment} · {c.domicile}
                    </div>
                  </div>
                </div>

                <div className="row wrap" style={{ gap: 6, marginTop: 14 }}>
                  <Badge tone="neutral">{c.mandate}</Badge>
                  <Badge tone="neutral">{c.riskProfile}</Badge>
                  {sc?.high > 0 && <Badge tone="high">{sc.high} to action</Badge>}
                  {overdue && <Badge tone="medium">Contact due</Badge>}
                </div>

                <div className="cc-stats">
                  <div className="cc-stat">
                    <div className="v">{formatChf(c.aumChf)}</div>
                    <div className="k">Assets</div>
                  </div>
                  <div className="cc-stat">
                    <div className="v" style={{ color: c.ytdReturn >= 0 ? 'var(--ok)' : 'var(--danger)' }}>
                      {c.ytdReturn >= 0 ? <ArrowUpRight size={14} style={{ verticalAlign: -2 }} /> : <ArrowDownRight size={14} style={{ verticalAlign: -2 }} />}
                      {formatPct(c.ytdReturn)}
                    </div>
                    <div className="k">YTD</div>
                  </div>
                  <div className="cc-stat">
                    <div className="v">{sc?.total || 0}</div>
                    <div className="k">Signals</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
