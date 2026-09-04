import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Users, AlertTriangle, Eye, CircleCheck } from 'lucide-react'
import { PageHeader, Card, Loading } from '../components/ui.jsx'
import PriorityClientCard from '../components/PriorityClientCard.jsx'
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
    { icon: Users, value: rm.clientsMonitored ?? enriched.length, label: 'Clients Monitored', note: 'Across your book' },
    { icon: AlertTriangle, value: attention.length, label: 'Clients Requiring Attention', note: 'High-priority situations', tone: 'high' },
    { icon: Eye, value: monitor.length, label: 'Monitor / Watch', note: 'Developing, not urgent', tone: 'warn' },
    { icon: CircleCheck, value: clear.length, label: 'No Immediate Action', note: 'Stable for now', tone: 'muted' },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Relationship Manager desk"
        title={`Good morning, ${rm.name.split(' ')[0]}`}
        subtitle="Here is what requires your attention today, ordered by relevance to each client."
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

      {/* Clients requiring attention */}
      <div className="row between" style={{ marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 18 }} className="serif">Clients requiring attention</h3>
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
        <div className="grid cols-2" style={{ gap: 18, marginBottom: 28 }}>
          {rankedAttention.map((e, i) => (
            <PriorityClientCard
              key={e.client.id}
              client={e.client}
              intelligence={e.intel}
              rank={i + 1}
            />
          ))}
        </div>
      )}

      {/* Monitor list — lighter treatment */}
      {monitor.length > 0 && (
        <Card style={{ marginBottom: 28 }}>
          <div className="card-head">
            <h3>Monitor / watch</h3>
            <span className="muted" style={{ fontSize: 12.5 }}>{monitor.length} clients</span>
          </div>
          <div>
            {monitor.map((e) => (
              <Link
                to={`/clients/${e.client.id}`}
                key={e.client.id}
                className="signal-compact"
                style={{ display: 'block' }}
              >
                <div className="row between">
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{e.client.name}</span>
                  <span className="badge badge-medium">Monitor</span>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  {e.client.id} · {e.client.riskProfile} · {e.client.domicile}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
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
