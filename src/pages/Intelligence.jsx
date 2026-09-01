import { useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { PageHeader, Card, Loading } from '../components/ui.jsx'
import SignalCard from '../components/SignalCard.jsx'
import { getIntelligence } from '../services/dataService.js'

const PRIORITIES = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High priority' },
  { key: 'medium', label: 'Monitor' },
  { key: 'low', label: 'Opportunities' },
]

export default function Intelligence() {
  const [signals, setSignals] = useState(null)
  const [priority, setPriority] = useState('all')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    getIntelligence().then(setSignals)
  }, [])

  const categories = useMemo(() => {
    if (!signals) return []
    return ['all', ...Array.from(new Set(signals.map((s) => s.category)))]
  }, [signals])

  const filtered = useMemo(() => {
    if (!signals) return []
    return signals
      .filter((s) => (priority === 'all' ? true : s.priority === priority))
      .filter((s) => (category === 'all' ? true : s.category === category))
      .sort((a, b) => rank(a.priority) - rank(b.priority))
  }, [signals, priority, category])

  if (!signals) return <Loading label="Reading signals" />

  const counts = {
    high: signals.filter((s) => s.priority === 'high').length,
    medium: signals.filter((s) => s.priority === 'medium').length,
    low: signals.filter((s) => s.priority === 'low').length,
  }

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence"
        title="What matters, to whom, and why"
        subtitle="Every signal is tied to a specific client and a stated objective. This is judgement about relevance, not a feed of raw alerts."
      />

      <div className="grid cols-3" style={{ marginBottom: 24 }}>
        <SummaryTile tone="high" label="Need a decision now" value={counts.high} note="Time-sensitive client situations" />
        <SummaryTile tone="medium" label="Worth monitoring" value={counts.medium} note="Developing but not urgent" />
        <SummaryTile tone="low" label="Opportunities" value={counts.low} note="Ways to add value proactively" />
      </div>

      <Card className="card-pad" style={{ marginBottom: 24 }}>
        <div className="row between wrap" style={{ gap: 16 }}>
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
          <div className="row wrap" style={{ gap: 8 }}>
            {categories.map((c) => (
              <button
                key={c}
                className={`chip${category === c ? ' active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c === 'all' ? 'All types' : c}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="empty">No signals match these filters.</Card>
      ) : (
        <div className="grid cols-2" style={{ gap: 18 }}>
          {filtered.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
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

function rank(p) {
  return { high: 0, medium: 1, low: 2 }[p] ?? 3
}
