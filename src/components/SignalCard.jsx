import { Link } from 'react-router-dom'
import { ArrowRight, Lightbulb, TrendingUp, Clock } from 'lucide-react'
import { PriorityBadge, Badge, Confidence } from './ui.jsx'
import { formatDate } from '../utils/format.js'

// The signal card is the core storytelling unit of WealthLens:
// what happened (trigger) -> who it affects (client) -> why it matters (why)
// -> what to do (suggestedAction). Compact and full variants.

export default function SignalCard({ signal, variant = 'full' }) {
  if (variant === 'compact') {
    return (
      <div className="signal-compact">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ gap: 8 }}>
            <PriorityBadge priority={signal.priority} />
            <Badge tone="neutral">{signal.category}</Badge>
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            <Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {signal.horizon}
          </span>
        </div>
        <h4 style={{ margin: '10px 0 6px', fontSize: 15 }}>{signal.headline}</h4>
        <div className="muted" style={{ fontSize: 13 }}>
          <Link className="link-gold" to={`/clients/${signal.clientId}`}>
            {signal.clientName}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="signal-card card">
      <div className="signal-accent" data-priority={signal.priority} />
      <div className="card-pad">
        <div className="row between wrap" style={{ marginBottom: 12 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <PriorityBadge priority={signal.priority} />
            <Badge tone="neutral">{signal.category}</Badge>
            <span className="muted" style={{ fontSize: 12.5 }}>
              <Clock size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              {signal.horizon}
            </span>
          </div>
          <Confidence value={signal.confidence} />
        </div>

        <h3 style={{ fontSize: 18, lineHeight: 1.3 }} className="serif">
          {signal.headline}
        </h3>

        <div className="signal-client">
          For{' '}
          <Link className="link-gold" to={`/clients/${signal.clientId}`}>
            {signal.clientName}
          </Link>
        </div>

        <p className="signal-trigger">{signal.trigger}</p>

        <div className="signal-why">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Why this matters</div>
          <p style={{ margin: 0 }}>{signal.why}</p>
        </div>

        <div className="signal-impact">
          <TrendingUp size={15} strokeWidth={2} />
          <span>{signal.impact}</span>
        </div>

        <div className="signal-action">
          <Lightbulb size={16} strokeWidth={2} />
          <div>
            <div className="eyebrow" style={{ marginBottom: 3 }}>Prepared action</div>
            <div>{signal.suggestedAction}</div>
          </div>
        </div>

        <div className="row between" style={{ marginTop: 16 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Detected {formatDate(signal.createdAt)}
          </span>
          <Link className="link-gold" to={`/intelligence/${signal.id}`}>
            Review intelligence <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}
