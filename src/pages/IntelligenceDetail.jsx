import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Lightbulb } from 'lucide-react'
import { PageHeader, Card, PriorityBadge, Confidence, Loading } from '../components/ui.jsx'
import { getSignalById } from '../services/dataService.js'
import { formatDate } from '../utils/format.js'

// Prototype relevance factors — static mock values for demonstration purposes.
// These are not AI-generated scores. They illustrate how portfolio exposure,
// market context and client objectives could be combined to help an RM
// prioritise attention.
const RELEVANCE_FACTORS = [
  { label: 'Portfolio Exposure', score: 91 },
  { label: 'Market Impact',      score: 82 },
  { label: 'Goal Sensitivity',   score: 94 },
  { label: 'Urgency',            score: 88 },
]

export default function IntelligenceDetail() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let active = true
    setState({ loading: true })
    getSignalById(id).then((signal) => {
      if (active) setState({ loading: false, signal })
    })
    return () => {
      active = false
    }
  }, [id])

  if (state.loading) return <Loading label="Loading signal" />

  const { signal } = state

  if (!signal) {
    return (
      <div>
        <Link className="link-gold" to="/intelligence" style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} /> All signals
        </Link>
        <PageHeader title="Signal not found" subtitle="This signal does not exist or may have been removed." />
      </div>
    )
  }

  return (
    <div>
      <Link className="link-gold" to="/intelligence" style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={15} /> All signals
      </Link>

      {/* Title spans full width */}
      <PageHeader
        eyebrow={`${signal.category} · ${signal.horizon}`}
        title={signal.headline}
      />

      {/* ── Responsive 2-column body ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 13fr) minmax(0, 7fr)',
        gap: 24,
        alignItems: 'start',
      }}>

        {/* ══ LEFT COLUMN: Why / factors ══ */}
        <div className="grid" style={{ gap: 20 }}>

          {/* Why this client? */}
          <Card>
            <div className="card-head">
              <h3 className="serif" style={{ fontSize: 17 }}>Why this client?</h3>
            </div>
            <div className="card-pad" style={{ paddingTop: 18 }}>

              {/* Prose capped at 72ch so lines stay readable even in a wide card */}
              <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.65, maxWidth: '72ch' }}>
                {signal.why}
              </p>

              {/* Relevance factors */}
              <div className="eyebrow" style={{ marginBottom: 12 }}>
                Prototype relevance factors
              </div>
              <div className="grid cols-2" style={{ gap: 12, marginBottom: 16 }}>
                {RELEVANCE_FACTORS.map(({ label, score }) => (
                  <RelevanceFactor key={label} label={label} score={score} />
                ))}
              </div>

              {/* Disclaimer note */}
              <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-muted)', lineHeight: 1.55, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                Prototype relevance factors illustrate how portfolio exposure, market context and
                client objectives can be combined to help an RM prioritise attention.
              </p>
            </div>
          </Card>
        </div>

        {/* ══ RIGHT COLUMN: metadata · impact · preparation ══ */}
        <div className="grid" style={{ gap: 20 }}>

          {/* Signal metadata */}
          <Card className="card-pad">
            <div className="row wrap" style={{ gap: 10, marginBottom: 20 }}>
              <PriorityBadge priority={signal.priority} />
              <Confidence value={signal.confidence} />
            </div>

            <div className="kv">
              <span className="k">Client</span>
              <span className="v">
                <Link className="link-gold" to={`/clients/${signal.clientId}`}>
                  {signal.clientName}
                </Link>
              </span>
            </div>
            <div className="kv">
              <span className="k">Detected</span>
              <span className="v">{formatDate(signal.createdAt)}</span>
            </div>
            <div className="kv">
              <span className="k">Horizon</span>
              <span className="v">{signal.horizon}</span>
            </div>
            <div className="kv">
              <span className="k">Category</span>
              <span className="v">{signal.category}</span>
            </div>
          </Card>

          {/* Potential impact */}
          <Card className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Potential impact</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
              <TrendingUp size={15} strokeWidth={2} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 2 }} />
              <span>{signal.impact}</span>
            </div>
          </Card>

          {/* RM preparation */}
          <Card className="card-pad" style={{ border: '1px solid var(--gold-tint)', background: 'linear-gradient(180deg, var(--gold-tint), #fbf7ec)' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>RM preparation</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--ink)' }}>
              <Lightbulb size={15} strokeWidth={2} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 2 }} />
              <span>{signal.suggestedAction}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Compact metric tile for a single relevance factor score.
function RelevanceFactor({ label, score }) {
  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--surface-2)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-muted)', fontWeight: 600, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--primary)', lineHeight: 1 }}>
          {score}
        </div>
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ width: `${score}%`, height: '100%', background: 'var(--primary)', borderRadius: 3 }} />
        </div>
      </div>
    </div>
  )
}
