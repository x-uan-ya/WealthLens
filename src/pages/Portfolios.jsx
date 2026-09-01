import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { PageHeader, Card, Loading } from '../components/ui.jsx'
import { getClients, getAllPortfolios } from '../services/dataService.js'
import { formatChf, formatPct } from '../utils/format.js'

const CLASS_COLORS = {
  Equities: '#0d2a3a',
  'Fixed income': '#3a6070',
  'Real estate': '#b3872f',
  'Private markets': '#8a9ba3',
  Cash: '#cdd8dd',
  Derivatives: '#6b7a83',
  Alternatives: '#c8a24a',
}

export default function Portfolios() {
  const [clients, setClients] = useState(null)
  const [portfolios, setPortfolios] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    getClients().then((cs) => {
      setClients(cs)
      setSelectedId(cs[0]?.id)
    })
    getAllPortfolios().then(setPortfolios)
  }, [])

  const bookAllocation = useMemo(() => {
    if (!clients) return []
    const totals = {}
    let totalAum = 0
    for (const c of clients) {
      totalAum += c.aumChf
      for (const a of c.concentration) {
        totals[a.label] = (totals[a.label] || 0) + (a.pct / 100) * c.aumChf
      }
    }
    return Object.entries(totals)
      .map(([label, value]) => ({ label, value, pct: (value / totalAum) * 100 }))
      .sort((a, b) => b.value - a.value)
  }, [clients])

  if (!clients || !portfolios) return <Loading label="Aggregating portfolios" />

  const selected = clients.find((c) => c.id === selectedId)
  const selectedPortfolio = portfolios[selectedId]
  const totalAum = clients.reduce((s, c) => s + c.aumChf, 0)

  return (
    <div>
      <PageHeader
        eyebrow="Portfolios"
        title="Book composition"
        subtitle="How your clients' capital is allocated across the book, and how individual mandates are tracking."
      />

      <div className="grid" style={{ gridTemplateColumns: '1fr 1.4fr', marginBottom: 24, alignItems: 'start' }}>
        <Card>
          <div className="card-head"><h3>Aggregate allocation</h3></div>
          <div className="card-pad">
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bookAllocation}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={62}
                    outerRadius={98}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {bookAllocation.map((a) => (
                      <Cell key={a.label} fill={CLASS_COLORS[a.label] || '#8a9ba3'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, n) => [formatChf(v), n]}
                    contentStyle={tooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ marginTop: 8 }}>
              {bookAllocation.map((a) => (
                <div className="row between" key={a.label} style={{ padding: '6px 0', fontSize: 13.5 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: CLASS_COLORS[a.label] || '#8a9ba3' }} />
                    {a.label}
                  </span>
                  <span style={{ fontWeight: 600 }}>{a.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head">
            <h3>Book at a glance</h3>
            <span className="muted" style={{ fontSize: 12.5 }}>{formatChf(totalAum)} total</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Mandate</th>
                <th>Assets</th>
                <th>YTD</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td className="muted">{c.mandate}</td>
                  <td>{formatChf(c.aumChf)}</td>
                  <td className={c.ytdReturn >= 0 ? 'pos' : 'neg'} style={{ fontWeight: 600 }}>
                    {formatPct(c.ytdReturn, { sign: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Per-client performance explorer */}
      <Card>
        <div className="card-head">
          <h3>Mandate performance</h3>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={selectStyle}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="card-pad">
          {selectedPortfolio && (
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selectedPortfolio.performance} margin={{ left: -14, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="pf2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d2a3a" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="#0d2a3a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7a83' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7a83' }} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Area type="monotone" dataKey="portfolio" name="Portfolio" stroke="#0d2a3a" strokeWidth={2.4} fill="url(#pf2)" />
                  <Area type="monotone" dataKey="benchmark" name="Benchmark" stroke="#b3872f" strokeWidth={1.6} fillOpacity={0} strokeDasharray="4 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {selected && selectedPortfolio && (
            <div className="grid cols-2" style={{ marginTop: 16, gap: 16 }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Top holdings</div>
                {selectedPortfolio.topHoldings.map((h) => (
                  <div className="kv" key={h.name}>
                    <span className="k">{h.name}</span>
                    <span className="v">{h.weight}%</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Allocation</div>
                {selected.concentration.map((a) => (
                  <div className="alloc-row" key={a.label}>
                    <span className="a-label">{a.label}</span>
                    <span className="a-track">
                      <span className="a-fill" style={{ width: `${a.pct}%`, background: CLASS_COLORS[a.label] || '#0d2a3a' }} />
                    </span>
                    <span className="a-pct">{a.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

const tooltipStyle = {
  border: '1px solid #e6e3dc',
  borderRadius: 10,
  fontSize: 13,
  boxShadow: '0 4px 12px rgba(22,35,43,0.08)',
}

const selectStyle = {
  border: '1px solid var(--line-strong)',
  borderRadius: 8,
  padding: '7px 12px',
  fontSize: 13.5,
  fontFamily: 'inherit',
  background: 'var(--surface)',
  color: 'var(--ink)',
  cursor: 'pointer',
}
