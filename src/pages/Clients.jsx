import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import { getClients, getIntelligence } from '../services/dataService.js'
import { formatChf, initialsOf, timeAgo, daysSince } from '../utils/format.js'

const RISK_PROFILES = ['All', 'Conservative', 'Moderate', 'Balanced', 'Growth', 'Aggressive']
const PRIORITIES = ['All', 'High', 'Medium', 'Low', 'None']
const VALUE_BANDS = [
  { key: 'All', label: 'Any value', min: 0, max: Infinity },
  { key: 'lt50', label: '< S$50m', min: 0, max: 50_000_000 },
  { key: '50-150', label: 'S$50m – 150m', min: 50_000_000, max: 150_000_000 },
  { key: 'gt150', label: '> S$150m', min: 150_000_000, max: Infinity },
]
const RELEVANCE_BANDS = [
  { key: 'All', label: 'Any score', min: 0 },
  { key: '80', label: '80+', min: 80 },
  { key: '60', label: '60+', min: 60 },
  { key: '40', label: '40+', min: 40 },
]

const priorityRank = { High: 3, Medium: 2, Low: 1, None: 0 }
const priorityTone = { High: 'high', Medium: 'medium', Low: 'low', None: 'neutral' }

export default function Clients() {
  const [clients, setClients] = useState(null)
  const [signals, setSignals] = useState([])
  const [query, setQuery] = useState('')
  const [risk, setRisk] = useState('All')
  const [priority, setPriority] = useState('All')
  const [valueBand, setValueBand] = useState('All')
  const [relevanceBand, setRelevanceBand] = useState('All')
  const [sort, setSort] = useState({ key: 'relevance', dir: 'desc' })
  const navigate = useNavigate()

  useEffect(() => {
    getClients().then(setClients)
    getIntelligence().then(setSignals)
  }, [])

  // Derive each client's current priority + top relevance from the
  // intelligence engine. This keeps the table honest: priority is not a
  // static label, it reflects what the engine currently sees.
  const intelByClient = useMemo(() => {
    const map = {}
    for (const s of signals) {
      const cur = map[s.clientId]
      const score = s.relevanceScore ?? 0
      if (!cur || score > cur.relevance) {
        map[s.clientId] = {
          relevance: score,
          priority: cap(s.priority),
        }
      }
    }
    return map
  }, [signals])

  const rows = useMemo(() => {
    if (!clients) return []
    return clients.map((c) => {
      const intel = intelByClient[c.id]
      return {
        ...c,
        priority: intel?.priority ?? 'None',
        relevance: intel?.relevance ?? 0,
        lastDays: daysSince(c.contact.lastContact) ?? 9999,
      }
    })
  }, [clients, intelByClient])

  const filtered = useMemo(() => {
    const band = VALUE_BANDS.find((b) => b.key === valueBand)
    const rel = RELEVANCE_BANDS.find((b) => b.key === relevanceBand)
    const q = query.trim().toLowerCase()
    let out = rows
      .filter((c) => (risk === 'All' ? true : c.riskProfile === risk))
      .filter((c) => (priority === 'All' ? true : c.priority === priority))
      .filter((c) => c.aumChf >= band.min && c.aumChf < band.max)
      .filter((c) => c.relevance >= rel.min)
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.clientId.toLowerCase().includes(q) ||
          c.investmentObjective.toLowerCase().includes(q)
      )

    const { key, dir } = sort
    const mult = dir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      let av
      let bv
      switch (key) {
        case 'name':
          return a.name.localeCompare(b.name) * mult
        case 'value':
          av = a.aumChf; bv = b.aumChf; break
        case 'priority':
          av = priorityRank[a.priority]; bv = priorityRank[b.priority]; break
        case 'relevance':
          av = a.relevance; bv = b.relevance; break
        case 'last':
          av = a.lastDays; bv = b.lastDays; break
        default:
          av = a.relevance; bv = b.relevance
      }
      return (av - bv) * mult
    })
    return out
  }, [rows, risk, priority, valueBand, relevanceBand, query, sort])

  if (!clients) return <Loading label="Loading client book" />

  const toggleSort = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    )

  const filtersActive =
    risk !== 'All' || priority !== 'All' || valueBand !== 'All' || relevanceBand !== 'All' || query

  const clearFilters = () => {
    setRisk('All'); setPriority('All'); setValueBand('All'); setRelevanceBand('All'); setQuery('')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Clients"
        title="Your relationships"
        subtitle="A searchable book of high and ultra-high net worth clients. Priority and relevance are set by the intelligence engine, not by a static label."
      />

      {/* Search + filters */}
      <Card className="card-pad" style={{ marginBottom: 20 }}>
        <div className="search" style={{ maxWidth: 420, margin: '0 0 16px' }}>
          <Search size={16} />
          <input
            placeholder="Search by name, client ID or objective…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="filter-grid">
          <FilterGroup label="Risk profile" options={RISK_PROFILES} value={risk} onChange={setRisk} />
          <FilterGroup label="Priority" options={PRIORITIES} value={priority} onChange={setPriority} />
          <FilterGroup
            label="Portfolio value"
            options={VALUE_BANDS.map((b) => b.key)}
            labels={VALUE_BANDS.map((b) => b.label)}
            value={valueBand}
            onChange={setValueBand}
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
                  <Th label="Portfolio Value" col="value" sort={sort} onSort={toggleSort} align="right" />
                  <th>Risk Profile</th>
                  <th>Investment Objective</th>
                  <Th label="Current Priority" col="priority" sort={sort} onSort={toggleSort} />
                  <Th label="Relevance" col="relevance" sort={sort} onSort={toggleSort} align="right" />
                  <Th label="Last Interaction" col="last" sort={sort} onSort={toggleSort} />
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
                          <span className="muted" style={{ fontSize: 12 }}>{c.segment} · {c.domicile}</span>
                        </span>
                      </div>
                    </td>
                    <td className="mono muted">{c.clientId}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatChf(c.aumChf)}</td>
                    <td>{c.riskProfile}</td>
                    <td className="soft" style={{ maxWidth: 220 }}>{c.investmentObjective}</td>
                    <td>
                      <Badge tone={priorityTone[c.priority]}>{c.priority}</Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RelevanceCell score={c.relevance} />
                    </td>
                    <td className={c.lastDays > (c.contact.cadenceDays || 60) ? 'neg' : 'muted'}>
                      {timeAgo(c.contact.lastContact)}
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
  if (!score) return <span className="muted">—</span>
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

function cap(s = '') {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
