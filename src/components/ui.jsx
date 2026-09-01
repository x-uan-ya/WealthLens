// Small, reusable presentational primitives shared across pages.
import { ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react'

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  )
}

const priorityLabel = { high: 'High priority', medium: 'Monitor', low: 'Opportunity' }

export function PriorityBadge({ priority }) {
  return <span className={`badge badge-${priority}`}>{priorityLabel[priority] || priority}</span>
}

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Stat({ label, value, delta, deltaTone, foot }) {
  return (
    <Card className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {(delta || foot) && (
        <div className="stat-foot">
          {delta != null && (
            <span className={deltaTone === 'neg' ? 'neg' : 'pos'} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {deltaTone === 'neg' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
              {delta}
            </span>
          )}
          {foot && <span className="muted">{foot}</span>}
        </div>
      )}
    </Card>
  )
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="loading">
      <Loader2 size={22} className="spin" style={{ animation: 'spin 0.9s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ marginLeft: 10 }}>{label}…</span>
    </div>
  )
}

export function Confidence({ value }) {
  const pct = Math.round((value || 0) * 100)
  return (
    <div title={`Signal confidence ${pct}%`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 56, height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--gold-soft)' }} />
      </div>
      <span className="muted" style={{ fontSize: 12 }}>{pct}%</span>
    </div>
  )
}
