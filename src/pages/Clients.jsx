import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import { getOfficialClients, getClientIntelligence } from '../services/dataService.js'
import { initialsOf } from '../utils/format.js'

const RISK_PROFILES = ['All', 'Conservative', 'Moderate', 'Balanced', 'Growth', 'Aggressive']
const PRIORITIES = ['All', 'HIGH', 'MEDIUM', 'LOW', 'NONE']
const RELEVANCE_BANDS = [
  { key: 'All', label: 'Any score', min: 0 },
  { key: '80', label: '80+', min: 80 },
  { key: '60', label: '60+', min: 60 },
  { key: '40', label: '40+', min: 40 },
]

const priorityRank = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 }
const priorityTone = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low', NONE: 'neutral' }
const priorityLabel = { HIGH: 'High', MEDIUM: 'Monitor', LOW: 'Low', NONE: 'No action' }

export default function Clients() {
  const [rows, setRows] = useState(null)
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('All')
  const [priority, setPriority] = useState('All')
  const [relevanceBand, setRelevanceBand] = useState('All')
  const [sort, setSort] = useState({ key: 'priority', dir: 'desc' })
  const navigate = useNavigate()

  useEffect(() => {
    getOfficialClients().then((clients) => {
      // Attach intelligence-derived priority + relevance where available.
      // Priority/relevance come from the engine, never a static guess.
      Promise.all(
        clients.map((c) =>
          getClientIntelligence(c.id).then((intel) => ({
            ...c,
            priority: intel?.priority || c.priority || 'NONE',
            relevance: intel?.relevanceScore ?? null,
          }))
        )
      ).then(setRows)
    })
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return []
    const rel = RELEVANCE_BANDS.find((b) => b.key === relevanceBand)
    const q = query.trim().toLowerCase()
    let out = rows
      .filter((c) => (risk === 'All' ? true : c.riskProfile === risk))
      .filter((c) => (priority === 'All' ? true : c.priority === priority))
      .filter((c) => (rel.min === 0 ? true : (c.relevance ?? 0) >= rel.min))
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q) ||
          (c.lifeStage || '').toLowerCase().includes(q)
      )

    const { key, dir } = sort
    const mult = dir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      switch (key) {
        case 'name':
          return a.name.localeCompare(b.name) * mult
        case 'priority':
          return (priorityRank[a.priority] - priorityRank[b.priority]) * mult
        case 'relevance':
          return ((a.relevance ?? 0) - (b.relevance ?? 0)) * mult
        default:
          return 0
      }
    })
    return out
  }, [rows, risk, priority, relevanceBand, query, sort])

  if (!rows) return <Loading label="Loading client book" />

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    )

  const filtersActive =
    risk !== 'All' || priority !== 'All' || relevanceBand !== 'All' || query

  const clearFilters = () => {
    setRisk('All'); setPriority('All'); setRelevanceBand('All'); setQuery('')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Clients"
        title="Your relationships"
        subtitle="The official client book. Priority and relevance are set by the intelligence engine, not by a static label."
      />

      {/* Search + filters */}
      <Card className="card-pad" style={{ marginBottom: 20 }}>
        <div className="search" style={{ maxWidth: 420, margin: '0 0 16px' }}>
          <Search size={16} />
          <input
            placeholder="Search by name, client ID or context…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="filter-grid">
          <FilterGroup label="Risk profile" options={RISK_PROFILES} value={risk} onChange={setRisk} />
          <FilterGroup
            label="Priority"
            options={PRIORITIES}
            labels={PRIORITIES.map((p) => (p === 'All' ? 'All' : priorityLabel[p]))}
            value={priority}
            onChange={setPriority}
          />
          <FilterGroup
            label="Relevance score"
            options={RELEVANCE_BANDS.map((b) => b.key)}
            labels={RELEVANCE_BANDS.map((b) => b.label)}
            value={relevanceBand}
            onChange={setRelevanceBand}
          />
        </div>

        <div className="row between" style={{ marginTop: 16 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Showing {filtered.length} of {rows.length} clients
          </span>
          {filtersActive && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div className="empty">No clients match these filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table client-table">
              <thead>
                <tr>
                  <Th label="Client" col="name" sort={sort} onSort={toggleSort} />
                  <th>Client ID</th>
                  <th>Risk Profile</th>
                  <th>Context</th>
                  <Th label="Current Priority" col="priority" sort={sort} onSort={toggleSort} />
                  <Th label="Relevance" col="relevance" sort={sort} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                    <td>
                      <div className="row" style={{ gap: 11 }}>
                        <span className="avatar-lg" style={{ width: 36, height: 36, fontSize: 12.5 }}>
                          {initialsOf(c.name)}
                        </span>
                        <span>
                          <span style={{ fontWeight: 600, display: 'block' }}>{c.name}</span>
                          <span className="muted" style={{ fontSize: 12 }}>{c.domicile}</span>
                        </span>
                      </div>
                    </td>
                    <td className="mono muted">{c.id}</td>
                    <td>{c.riskProfile}</td>
                    <td className="soft" style={{ maxWidth: 240 }}>{c.lifeStage || '—'}</td>
                    <td>
                      <Badge tone={priorityTone[c.priority]}>{priorityLabel[c.priority] || c.priority}</Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RelevanceCell score={c.relevance} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Th({ label, col, sort, onSort, align }) {
  const active = sort.key === col
  return (
    <th
      className="th-sort"
      style={{ textAlign: align || 'left', cursor: 'pointer' }}
      onClick={() => onSort(col)}
    >
      <span className="row" style={{ gap: 5, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {label}
        {active ? (
          sort.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
        ) : (
          <ChevronsUpDown size={13} style={{ opacity: 0.35 }} />
        )}
      </span>
    </th>
  )
}

function FilterGroup({ label, options, labels, value, onChange }) {
  return (
    <div className="filter-group">
      <div className="filter-label">{label}</div>
      <div className="chip-group">
        {options.map((opt, i) => (
          <button
            key={opt}
            className={`chip${value === opt ? ' active' : ''}`}
            onClick={() => onChange(opt)}
          >
            {labels ? labels[i] : opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function RelevanceCell({ score }) {
  if (score == null) return <span className="muted">—</span>
  const tone = score >= 80 ? 'var(--danger)' : score >= 60 ? 'var(--warn)' : 'var(--ok)'
  return (
    <span className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
      <span style={{ fontWeight: 600, fontFamily: 'var(--font-serif)' }}>{score}</span>
      <span className="relevance-track">
        <span style={{ width: `${score}%`, background: tone }} />
      </span>
    </span>
  )
}
