import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import { FlaskConical, TrendingDown, Info } from 'lucide-react'
import { PageHeader, Card, Loading } from '../components/ui.jsx'
import { getClients } from '../services/dataService.js'
import { formatChf } from '../utils/format.js'

// Simple, transparent sensitivity model. Each asset class has an assumed
// beta to three shock factors. This is a preparation aid, not a risk engine,
// and the assumptions are shown to the RM on screen.
const SENSITIVITY = {
  //                equityShock  rateShock(+100bps)  fxShock(USD -10%)
  Equities: { equity: 1.0, rate: -0.1, fx: -0.15 },
  'Fixed income': { equity: 0.05, rate: -0.55, fx: -0.05 },
  'Real estate': { equity: 0.4, rate: -0.35, fx: -0.1 },
  'Private markets': { equity: 0.7, rate: -0.2, fx: -0.2 },
  Cash: { equity: 0, rate: 0.02, fx: -0.3 },
  Derivatives: { equity: -0.3, rate: 0, fx: 0 },
  Alternatives: { equity: 0.5, rate: -0.15, fx: -0.1 },
}

const PRESETS = [
  { key: 'custom', label: 'Custom' },
  { key: 'equity', label: 'Equity sell-off', equity: -20, rate: 0, fx: 0 },
  { key: 'rates', label: 'Rate spike', equity: -5, rate: 100, fx: 0 },
  { key: 'usd', label: 'USD weakness', equity: 0, rate: 0, fx: -10 },
  { key: 'stagflation', label: 'Stagflation', equity: -15, rate: 75, fx: -6 },
]

export default function ScenarioLab() {
  const [clients, setClients] = useState(null)
  const [clientId, setClientId] = useState('all')
  const [equity, setEquity] = useState(-20)
  const [rate, setRate] = useState(0)
  const [fx, setFx] = useState(0)
  const [preset, setPreset] = useState('equity')

  useEffect(() => {
    getClients().then(setClients)
  }, [])

  const applyPreset = (p) => {
    setPreset(p.key)
    if (p.key !== 'custom') {
      setEquity(p.equity)
      setRate(p.rate)
      setFx(p.fx)
    }
  }

  const scope = useMemo(() => {
    if (!clients) return []
    return clientId === 'all' ? clients : clients.filter((c) => c.id === clientId)
  }, [clients, clientId])

  const results = useMemo(() => {
    return scope.map((c) => {
      let pctImpact = 0
      for (const a of c.concentration) {
        const s = SENSITIVITY[a.label] || { equity: 0.5, rate: -0.2, fx: -0.1 }
        const weight = a.pct / 100
        const contrib =
          weight *
          (s.equity * (equity / 100) +
            s.rate * (rate / 100) +
            s.fx * (fx / 100))
        pctImpact += contrib
      }
      const value = c.aumChf * pctImpact
      return { id: c.id, name: c.name, pct: pctImpact * 100, value, aum: c.aumChf }
    })
  }, [scope, equity, rate, fx])

  if (!clients) return <Loading label="Loading scenario model" />

  const totalImpact = results.reduce((s, r) => s + r.value, 0)
  const totalAum = scope.reduce((s, c) => s + c.aumChf, 0)
  const totalPct = totalAum ? (totalImpact / totalAum) * 100 : 0
  const chartData = [...results].sort((a, b) => a.value - b.value)

  return (
    <div>
      <PageHeader
        eyebrow="Scenario Lab"
        title="Prepare for the conversation before it happens"
        subtitle="Model a market shock across the book or a single client, so you can speak to downside with specifics rather than reassurance."
      />

      <div className="scenario-grid">
        {/* Controls */}
        <Card className="card-pad">
          <div className="row" style={{ gap: 8, marginBottom: 18 }}>
            <FlaskConical size={18} color="var(--gold)" />
            <h3 style={{ fontSize: 15 }}>Scenario</h3>
          </div>

          <div className="control">
            <label>Apply to</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={selectStyle}
            >
              <option value="all">Whole book</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="control">
            <label>Presets</label>
            <div className="chip-group">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  className={`chip${preset === p.key ? ' active' : ''}`}
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="hr" />

          <Slider label="Equity markets" value={equity} min={-40} max={20} suffix="%" onChange={(v) => { setEquity(v); setPreset('custom') }} />
          <Slider label="Interest rates" value={rate} min={-100} max={200} suffix=" bps" onChange={(v) => { setRate(v); setPreset('custom') }} />
          <Slider label="USD vs CHF" value={fx} min={-20} max={20} suffix="%" onChange={(v) => { setFx(v); setPreset('custom') }} />

          <div className="row" style={{ gap: 8, marginTop: 10, fontSize: 12, color: 'var(--ink-muted)' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>A transparent sensitivity model. Assumptions are simplified for preparation, not valuation.</span>
          </div>
        </Card>

        {/* Results */}
        <div className="grid" style={{ gap: 20 }}>
          <Card className="card-pad">
            <div className="row between wrap">
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  Estimated impact {clientId === 'all' ? 'across the book' : ''}
                </div>
                <div className="impact-figure" style={{ color: totalImpact < 0 ? 'var(--danger)' : 'var(--ok)' }}>
                  {totalImpact < 0 ? '' : '+'}{formatChf(totalImpact)}
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {totalPct >= 0 ? '+' : ''}{totalPct.toFixed(1)}% of {formatChf(totalAum)}
                </div>
              </div>
              <div className="badge badge-neutral row" style={{ padding: '8px 12px' }}>
                <TrendingDown size={15} style={{ marginRight: 4 }} />
                {describeScenario(equity, rate, fx)}
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-head"><h3>Impact by client</h3></div>
            <div className="card-pad">
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => formatChf(v)} tick={{ fontSize: 11, fill: '#6b7a83' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#3a4a54' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => formatChf(v)} contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.map((r) => (
                        <Cell key={r.id} fill={r.value < 0 ? '#a23a34' : '#3f6b52'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-head"><h3>Talking points this scenario generates</h3></div>
            <div className="card-pad">
              {chartData.slice(0, 3).map((r) => (
                <div className="talking-point" key={r.id}>
                  <span className="n">→</span>
                  <span>
                    <strong>{r.name}</strong> would see an estimated {r.pct >= 0 ? 'gain' : 'drawdown'} of{' '}
                    <strong style={{ color: r.value < 0 ? 'var(--danger)' : 'var(--ok)' }}>
                      {formatChf(r.value)} ({r.pct.toFixed(1)}%)
                    </strong>
                    . Prepare the reasoning and any hedge before they ask.
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, suffix, onChange }) {
  return (
    <div className="control">
      <label>
        <span>{label}</span>
        <span className="val">{value > 0 ? '+' : ''}{value}{suffix}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function describeScenario(equity, rate, fx) {
  const parts = []
  if (equity !== 0) parts.push(`Equities ${equity > 0 ? '+' : ''}${equity}%`)
  if (rate !== 0) parts.push(`Rates ${rate > 0 ? '+' : ''}${rate}bps`)
  if (fx !== 0) parts.push(`USD ${fx > 0 ? '+' : ''}${fx}%`)
  return parts.join(' · ') || 'No shock applied'
}

const tooltipStyle = {
  border: '1px solid #e6e3dc',
  borderRadius: 10,
  fontSize: 13,
  boxShadow: '0 4px 12px rgba(22,35,43,0.08)',
}

const selectStyle = {
  width: '100%',
  border: '1px solid var(--line-strong)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13.5,
  fontFamily: 'inherit',
  background: 'var(--surface)',
  color: 'var(--ink)',
  cursor: 'pointer',
}
