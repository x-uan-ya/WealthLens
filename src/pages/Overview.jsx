import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Users, AlertTriangle, Eye, CircleCheck, ChevronDown, ShieldAlert, Activity } from 'lucide-react'
import { Card, Loading } from '../components/ui.jsx'
import {
  getOfficialRm,
  getOfficialClients,
  getClientIntelligence,
} from '../services/dataService.js'

// Attention buckets derived from client priority. No invented figures — every
// number is a count of real clients in the official book.
const bucketOf = (priority) => {
  if (priority === 'HIGH') return 'attention'
  if (priority === 'MEDIUM') return 'monitor'
  return 'clear' // LOW | NONE
}

export default function Overview() {
  const [data, setData] = useState(null)
  const [clearOpen, setClearOpen] = useState(false)

  useEffect(() => {
    getOfficialRm().then((rm) => {
      getOfficialClients().then((clients) => {
        // Attach an intelligence summary where the engine has produced one.
        Promise.all(
          clients.map((c) =>
            getClientIntelligence(c.id).then((intel) => ({
              client: c,
              intel: intel ? summariseIntel(intel) : null,
            }))
          )
        ).then((enriched) => setData({ rm, enriched }))
      })
    })
  }, [])

  if (!data) return <Loading label="Preparing your desk" />

  const { rm, enriched } = data

  const attention = enriched.filter((e) => bucketOf(e.client.priority) === 'attention')
  const monitor = enriched.filter((e) => bucketOf(e.client.priority) === 'monitor')
  const clear = enriched.filter((e) => bucketOf(e.client.priority) === 'clear')

  // Rank the attention list: presentation clients first, then by priority score.
  const rankedAttention = [...attention].sort((a, b) => {
    const ap = a.client.presentation ? 1 : 0
    const bp = b.client.presentation ? 1 : 0
    if (ap !== bp) return bp - ap
    return (b.intel?.priorityScore ?? 0) - (a.intel?.priorityScore ?? 0)
  })

  const kpis = [
    { icon: Users, value: rm.clientsMonitored ?? enriched.length, label: 'Total clients', note: 'Across your book', tone: 'total' },
    { icon: AlertTriangle, value: attention.length, label: 'Require attention', note: 'Priority situations', tone: 'high' },
    { icon: Eye, value: monitor.length, label: 'Monitoring', note: 'Developing, not urgent', tone: 'warn' },
    { icon: CircleCheck, value: clear.length, label: 'On track', note: 'No immediate action', tone: 'muted' },
  ]

  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className="overview-page">
      <div className="overview-head page-head">
        <div>
          <div className="eyebrow overview-eyebrow">Relationship Manager desk</div>
          <h1 className="page-title">Good morning, {rm.name.split(' ')[0]}</h1>
          <div className="overview-meta">
            <span>{today}</span><span className="overview-meta-dot" />
            <span>{rm.location || 'Asia Pacific desk'}</span>
          </div>
        </div>
        <div className="overview-quote">
          <span>“Better conversations<br />build brighter futures.”</span>
          <small>WealthLens intelligence desk</small>
        </div>
        <div className="overview-signal">
          <span className="overview-signal-dot" />
          <span><strong>{attention.length} clients</strong> require your attention today.</span>
        </div>
      </div>

      <div className="overview-kpis" style={{ marginBottom: 32 }}>
        {kpis.map((k) => (
          <Card className={`kpi kpi-executive${k.tone ? ` kpi-${k.tone}` : ''}`} key={k.label}>
            <div className={`kpi-icon${k.tone ? ` kpi-icon-${k.tone}` : ''}`}>
              <k.icon size={18} strokeWidth={2} />
            </div>
            <AnimatedNumber value={k.value} className={`kpi-value${k.tone === 'high' ? ' neg' : ''}`} />
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-note">{k.note}</div>
          </Card>
        ))}
      </div>

      <div className="row between overview-section-head" style={{ marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 18 }} className="serif"><ShieldAlert size={18} /> Clients requiring your attention</h3>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            Ranked by relevance to the client, not by how loud the market is.
          </p>
        </div>
        <Link className="link-gold" to="/clients">
          All clients <ArrowRight size={14} />
        </Link>
      </div>

      {rankedAttention.length === 0 ? (
        <Card className="empty">No clients currently require attention.</Card>
      ) : (
        <div className="overview-attention-table overview-attention-grid" style={{ marginBottom: 18 }}>
          <div className="overview-table-head"><span>#</span><span>Client</span><span>Verified trigger</span><span>Priority score</span><span>Actions</span></div>
          {rankedAttention.map((e, i) => (
            <AttentionRow
              key={e.client.id}
              client={e.client}
              intelligence={e.intel}
              rank={i + 1}
            />
          ))}
        </div>
      )}

      {/* Monitor list — lighter treatment */}
      <div className="overview-lower-grid">
        <StatusPanel title="Monitoring" subtitle="Clients to keep on your radar" count={monitor.length} icon={Eye} tone="monitor" entries={monitor} />
        <StatusPanel title="On track" subtitle="No immediate action required" count={clear.length} icon={CircleCheck} tone="clear" entries={clear} collapsible clearOpen={clearOpen} onToggle={() => setClearOpen((open) => !open)} />
      </div>
    </div>
  )
}

function AttentionRow({ client, intelligence, rank }) {
  const score = intelligence?.priorityScore ?? 0
  const priority = intelligence?.priority || client.priority || 'NONE'
  return (
    <Link to={`/clients/${client.id}`} className="overview-attention-row" data-priority={priority} style={{ '--priority-score': `${Math.min(100, Math.max(0, score))}%` }}>
      <span className="overview-rank">{rank}</span>
      <span className="overview-client-cell"><strong>{client.name}</strong><small>{client.id}</small></span>
      <span className="overview-trigger"><Activity size={15} /><span>{intelligence?.topSignalTitle || 'Verified portfolio signal'}</span></span>
      <span className="overview-score"><strong>{score}</strong><span className="overview-score-track"><i /></span></span>
      <span className="overview-review">Review <ArrowRight size={14} /></span>
    </Link>
  )
}

function StatusPanel({ title, subtitle, count, icon: Icon, tone, entries, collapsible = false, clearOpen = false, onToggle }) {
  const visible = collapsible && !clearOpen ? entries.slice(0, 3) : entries
  return (
    <Card className={`overview-status-panel overview-status-${tone}`}>
      <div className="overview-status-head">
        <div className="overview-status-title"><span className="overview-status-icon"><Icon size={16} /></span><span><strong>{title}</strong><small>{subtitle}</small></span><b>{count}</b></div>
        {collapsible && <button type="button" className="overview-view-all" onClick={onToggle}>{clearOpen ? 'Collapse' : 'View all'} <ChevronDown size={14} className={clearOpen ? 'is-open' : ''} /></button>}
      </div>
      <div className="overview-status-list">
        {visible.map((e) => <Link to={`/clients/${e.client.id}`} className="overview-status-row" key={e.client.id}><strong>{e.client.name}</strong><small>{e.client.id}</small><span>{e.intel?.topSignalTitle || 'No immediate action'}</span><em>{e.intel?.priorityScore ?? 0}</em><ArrowRight size={13} /></Link>)}
      </div>
      {collapsible && !clearOpen && entries.length > 3 && <button type="button" className="overview-show-more" onClick={onToggle}>Show {entries.length - 3} more clients <ChevronDown size={13} /></button>}
    </Card>
  )
}

function AnimatedNumber({ value, className }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let frame
    const started = performance.now()
    const duration = 520
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <div className={className}>{display}</div>
}

// Derive a compact card summary from a full intelligence object.
// Relevance and priority are read straight from the engine output — never
// inferred from AI confidence.
function summariseIntel(intel) {
  const topSignal = intel.signals?.[0]
  return {
    priority: intel.priority,
    priorityScore: intel.priorityScore,
    relevanceScore: intel.relevanceScore,
    topSignalTitle: topSignal?.title || null,
  }
}
