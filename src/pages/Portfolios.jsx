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
} from 'recharts'
import { PageHeader, Card, Loading } from '../components/ui.jsx'
import { getOfficialBook } from '../services/dataService.js'
import { formatUsd, formatPct } from '../utils/format.js'

// Official asset-class palette (matches asset_class values in holdings.csv).
const CLASS_COLORS = {
  Equity: '#0d2a3a',
  'Fixed Income': '#3a6070',
  Alternatives: '#c8a24a',
  'Structured Products': '#b3872f',
  'Cash and Equivalents': '#cdd8dd',
  'Real Estate': '#8a9ba3',
  Commodities: '#9c6f2f',
  Unknown: '#6b7a83',
}

const colorFor = (label) => CLASS_COLORS[label] || '#8a9ba3'

export default function Portfolios() {
  const [book, setBook] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    getOfficialBook().then((rows) => {
      if (!active) return
      setBook(rows)
      setSelectedId(rows[0]?.id)
    })
    return () => {
      active = false
    }
  }, [])

  const bookAllocation = useMemo(() => {
    if (!book) return []
    const totals = {}
    let totalAum = 0
    for (const c of book) {
      totalAum += c.aumUsd
      for (const a of c.allocation) {
        totals[a.label] = (totals[a.label] || 0) + (a.valueUsd || 0)
      }
    }
    return Object.entries(totals)
      .map(([label, value]) => ({ label, value, pct: totalAum > 0 ? (value / totalAum) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [book])

  if (!book) return <Loading label="Aggregating portfolios" />

  const selected = book.find((c) => c.id === selectedId)
  const totalAum = book.reduce((s, c) => s + c.aumUsd, 0)
  const perfData = (selected?.valueSeries || []).map((p) => ({
    date: p.date?.slice(2), // e.g. 26-08-26 -> compact label
    value: Math.round((p.totalUsd / 1_000_000) * 10) / 10,
  }))

  return (
    <div>
      <PageHeader
        eyebrow="Portfolios"
        title="Book composition"
        subtitle="How your clients' capital is allocated across the book, and how individual mandates are tracking. Cross-client figures are shown in USD (market_value_usd)."
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
                      <Cell key={a.label} fill={colorFor(a.label)} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [formatUsd(v), n]} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ marginTop: 8 }}>
              {bookAllocation.map((a) => (
                <div className="row between" key={a.label} style={{ padding: '6px 0', fontSize: 13.5 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: colorFor(a.label) }} />
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
            <span className="muted" style={{ fontSize: 12.5 }}>{formatUsd(totalAum)} total</span>
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
              {book.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/clients/${c.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td className="muted">{c.mandate}</td>
                  <td>{formatUsd(c.aumUsd)}</td>
                  <td
                    className={c.ytdReturn == null ? 'muted' : c.ytdReturn >= 0 ? 'pos' : 'neg'}
                    style={{ fontWeight: 600 }}
                  >
                    {c.ytdReturn == null ? '—' : formatPct(c.ytdReturn, { sign: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Per-client value + allocation explorer */}
      <Card>
        <div className="card-head">
          <h3>Portfolio value & allocation</h3>
          <select
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            style={selectStyle}
          >
            {book.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="card-pad">
          {selected && perfData.length > 0 && (
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={perfData} margin={{ left: -14, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="pf2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d2a3a" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="#0d2a3a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7a83' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7a83' }}
                    axisLine={false}
                    tickLine={false}
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tickFormatter={(v) => `US$${v}m`}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`US$${v}m`, 'Total value']} />
                  <Area type="monotone" dataKey="value" name="Total value (USD m)" stroke="#0d2a3a" strokeWidth={2.4} fill="url(#pf2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {selected && (
            <div className="grid cols-2" style={{ marginTop: 16, gap: 16 }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Snapshot totals</div>
                {(selected.valueSeries || []).map((p) => (
                  <div className="kv" key={p.date}>
                    <span className="k">{p.date}</span>
                    <span className="v">{formatUsd(p.totalUsd)}</span>
                  </div>
                ))}
                {(!selected.valueSeries || selected.valueSeries.length === 0) && (
                  <span className="muted" style={{ fontSize: 13 }}>No snapshot data.</span>
                )}
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Allocation (latest snapshot)</div>
                {selected.allocation.map((a) => (
                  <div className="alloc-row" key={a.label}>
                    <span className="a-label">{a.label}</span>
                    <span className="a-track">
                      <span className="a-fill" style={{ width: `${a.pct}%`, background: colorFor(a.label) }} />
                    </span>
                    <span className="a-pct">{a.pct}%</span>
                  </div>
                ))}
                {selected.allocation.length === 0 && (
                  <span className="muted" style={{ fontSize: 13 }}>No allocation data.</span>
                )}
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
