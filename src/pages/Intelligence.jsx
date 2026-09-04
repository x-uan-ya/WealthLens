import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SlidersHorizontal, ArrowRight, ShieldAlert } from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import { getOfficialClients, getClientIntelligence } from '../services/dataService.js'
import { initialsOf } from '../utils/format.js'

const PRIORITIES = [
  { key: 'all', label: 'All' },
  { key: 'HIGH', label: 'High priority' },
  { key: 'MEDIUM', label: 'Monitor' },
  { key: 'LOW', label: 'Opportunities' },
]

const priorityTone = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low', NONE: 'neutral' }
const rank = (p) => ({ HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 })[p] ?? 4

export default function Intelligence() {
  const [items, setItems] = useState(null)
  const [priority, setPriority] = useState('all')

  useEffect(() => {
    // Build the feed from clients that currently have intelligence objects.
    getOfficialClients().then((clients) => {
      Promise.all(
        clients.map((c) =>
          getClientIntelligence(c.id).then((intel) => (intel ? { client: c, intel } : null))
        )
      ).then((results) => setItems(results.filter(Boolean)))
    })
  }, [])

  const filtered = useMemo(() => {
    if (!items) return []
    return items
      .filter((it) => (priority === 'all' ? true : it.intel.priority === priority))
      .sort((a, b) => {
        const r = rank(a.intel.priority) - rank(b.intel.priority)
        if (r !== 0) return r
        return (b.intel.relevanceScore ?? 0) - (a.intel.relevanceScore ?? 0)
      })
  }, [items, priority])

  if (!items) return <Loading label="Reading intelligence" />

  const counts = {
    HIGH: items.filter((it) => it.intel.priority === 'HIGH').length,
    MEDIUM: items.filter((it) => it.intel.priority === 'MEDIUM').length,
    LOW: items.filter((it) => it.intel.priority === 'LOW').length,
  }

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence"
        title="What matters, to whom, and why"
        subtitle="Every item is tied to a specific client and grounded in verified data. This is judgement about relevance, not a feed of raw alerts."
      />

      <div className="grid cols-3" style={{ marginBottom: 24 }}>
        <SummaryTile tone="high" label="Need a decision now" value={counts.HIGH} note="Time-sensitive client situations" />
        <SummaryTile tone="medium" label="Worth monitoring" value={counts.MEDIUM} note="Developing but not urgent" />
        <SummaryTile tone="low" label="Opportunities" value={counts.LOW} note="Ways to add value proactively" />
      </div>

      <Card className="card-pad" style={{ marginBottom: 24 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="row muted" style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>
            <SlidersHorizontal size={15} style={{ marginRight: 6 }} /> Priority
          </span>
          {PRIORITIES.map((p) => (
            <button
              key={p.key}
              className={`chip${priority === p.key ? ' active' : ''}`}
              onClick={() => setPriority(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="empty">No intelligence matches this filter.</Card>
      ) : (
        <div className="grid cols-2" style={{ gap: 18 }}>
          {filtered.map(({ client, intel }) => {
            const top = intel.signals?.[0]
            return (
              <Link key={client.id} to={`/intelligence/${client.id}`} className="card intel-item">
                <div className="pcc-accent" data-priority={intel.priority} />
                <div className="card-pad">
                  <div className="row between" style={{ marginBottom: 10 }}>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="avatar-lg" style={{ width: 38, height: 38, fontSize: 13 }}>
                        {initialsOf(client.name)}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{client.name}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{client.id} · {client.riskProfile}</div>
                      </div>
                    </div>
                    <Badge tone={priorityTone[intel.priority]}>{intel.priority}</Badge>
                  </div>

                  {top && (
                    <div className="intel-signal">
                      <ShieldAlert size={14} />
                      <span>{top.title}</span>
                    </div>
                  )}

                  <div className="row between" style={{ marginTop: 14 }}>
                    {intel.relevanceScore != null && (
                      <span className="muted" style={{ fontSize: 12.5 }}>
                        Relevance <strong style={{ color: 'var(--ink)' }}>{intel.relevanceScore}</strong>/100
                      </span>
                    )}
                    <span className="link-gold" style={{ fontSize: 12.5 }}>
                      Open detail <ArrowRight size={13} />
                    </span>
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

function SummaryTile({ tone, label, value, note }) {
  return (
    <Card className="card-pad" style={{ borderTop: `3px solid var(--${toneVar(tone)})` }}>
      <div className="row between">
        <span className="stat-label">{label}</span>
        <span className={`badge badge-${tone}`}>{value}</span>
      </div>
      <div className="stat-value" style={{ fontSize: 30 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{note}</div>
    </Card>
  )
}

function toneVar(tone) {
  return { high: 'danger', medium: 'warn', low: 'ok' }[tone]
}
