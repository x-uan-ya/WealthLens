import { Link } from 'react-router-dom'
import { Lightbulb, Clock, FileText, Gauge } from 'lucide-react'
import { PriorityBadge, Badge } from './ui.jsx'
import { formatDate, formatMoney, formatPct } from '../utils/format.js'

// The signal card is the core storytelling unit of WealthLens:
// what happened (trigger) -> who it affects (client) -> why it matters (why)
// -> quantified relevance -> what to do. Compact and full variants.

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

  const impactTone = signal.scenarioImpact != null && signal.scenarioImpact < 0 ? 'neg' : 'pos'

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
        </div>

        {/* Client first — the signal is about a person, not a market */}
        <div className="signal-client-name">
          <Link to={`/clients/${signal.clientId}`}>{signal.clientName}</Link>
        </div>

        <h3 style={{ fontSize: 18, lineHeight: 1.3, marginTop: 2 }} className="serif">
          <Link to={`/intelligence/${signal.id}`} className="signal-headline-link">
            {signal.headline}
          </Link>
        </h3>

        {/* Quantified relevance strip */}
        <div className="signal-metrics">
          {signal.relevanceScore != null && (
            <div className="signal-metric">
              <div className="sm-label">
                <Gauge size={13} /> Relevance score
              </div>
              <div className="sm-value">
                {signal.relevanceScore}
                <span className="sm-unit"> / 100</span>
              </div>
              <div className="sm-bar">
                <span style={{ width: `${signal.relevanceScore}%` }} />
              </div>
            </div>
          )}
          {signal.exposurePct != null && (
            <div className="signal-metric">
              <div className="sm-label">Portfolio exposure</div>
              <div className="sm-value">{formatPct(signal.exposurePct)}</div>
            </div>
          )}
          {signal.scenarioImpact != null && (
            <div className="signal-metric">
              <div className="sm-label">Scenario impact</div>
              <div className={`sm-value ${impactTone}`}>
                {signal.scenarioImpact > 0 ? '+' : ''}
                {formatMoney(signal.scenarioImpact, { compact: false })}
              </div>
            </div>
          )}
        </div>

        <div className="signal-why">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Reason</div>
          <p style={{ margin: 0 }}>{signal.why}</p>
        </div>

        <div className="signal-action">
          <Lightbulb size={16} strokeWidth={2} />
          <div>
            <div className="eyebrow" style={{ marginBottom: 3 }}>Prepared action</div>
            <div>{signal.suggestedAction}</div>
          </div>
        </div>

        <div className="signal-buttons">
          <Link className="btn btn-primary btn-sm" to={`/intelligence/${signal.id}`}>
            Review Intelligence
          </Link>
          <Link className="btn btn-sm" to="/briefings">
            <FileText size={14} /> Prepare Brief
          </Link>
          <span className="muted" style={{ fontSize: 12, marginLeft: 'auto' }}>
            Detected {formatDate(signal.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
