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
import { FlaskConical, TrendingDown, Info, ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { PageHeader, Card, Loading } from '../components/ui.jsx'
import { getClients, getPortfolio } from '../services/dataService.js'
import { formatChf, formatPct } from '../utils/format.js'

// Simple, transparent sensitivity model. Each asset class has an assumed
// beta to three shock factors. This is a preparation aid, not a risk engine,
// and the assumptions are shown to the RM on screen.
const SENSITIVITY = {
  //                equityShock  rateShock(+100bps)  fxShock(USD -10%)
  Equities:          { equity: 1.0,  rate: -0.10, fx: -0.15 },
  'Fixed income':    { equity: 0.05, rate: -0.55, fx: -0.05 },
  'Real estate':     { equity: 0.4,  rate: -0.35, fx: -0.10 },
  'Private markets': { equity: 0.7,  rate: -0.20, fx: -0.20 },
  Cash:              { equity: 0,    rate:  0.02, fx: -0.30 },
  Derivatives:       { equity: -0.3, rate:  0,    fx:  0    },
  Alternatives:      { equity: 0.5,  rate: -0.15, fx: -0.10 },
  // Sector-level asset classes used by some clients (e.g. Catherine Tan).
  // Technology equities carry higher equity beta and moderate FX sensitivity
  // given the USD-denominated nature of major holdings.
  Technology:        { equity: 1.4,  rate: -0.08, fx: -0.20 },
  Financials:        { equity: 0.9,  rate:  0.10, fx: -0.10 },
  Healthcare:        { equity: 0.7,  rate: -0.05, fx: -0.12 },
}

// Default fallback for any unrecognised asset class.
const SENSITIVITY_DEFAULT = { equity: 0.5, rate: -0.20, fx: -0.10 }

const PRESETS = [
  { key: 'custom',       label: 'Custom' },
  { key: 'equity',       label: 'Equity sell-off',      equity: -20, rate:   0, fx:   0 },
  { key: 'rates',        label: 'Rate spike',            equity:  -5, rate: 100, fx:   0 },
  { key: 'usd',          label: 'USD weakness',          equity:   0, rate:   0, fx: -10 },
  { key: 'stagflation',  label: 'Stagflation',           equity: -15, rate:  75, fx:  -6 },
  // Prototype sector stress test — Technology -10%.
  // Expressed as an equity shock of -10% with a mild USD/CHF component (-5%)
  // reflecting the USD-denominated nature of major tech holdings.
  // The Technology sensitivity beta (1.4) amplifies the equity shock for
  // tech-concentrated clients. This is a deterministic preparation estimate,
  // not a market forecast.
  { key: 'tech10',       label: 'Technology −10%',      equity: -10, rate:   0, fx:  -5 },
]

// ---------------------------------------------------------------------------
// Shared impact calculator — used for both concentration rows and holdings.
// ---------------------------------------------------------------------------
function calcImpactPct(assetClassLabel, weightPct, equity, rate, fx) {
  const s = SENSITIVITY[assetClassLabel] ?? SENSITIVITY_DEFAULT
  return (weightPct / 100) * (
    s.equity * (equity / 100) +
    s.rate   * (rate   / 100) +
    s.fx     * (fx     / 100)
  )
}

// ---------------------------------------------------------------------------
// Technology-holding detector.
// Returns true when a holding name indicates semiconductor / tech exposure.
// Used only by the tech10 preset to apply a higher effective beta to tech
// holdings vs. generic equity holdings (financials, healthcare, etc.).
// Matching is done on holding name to avoid modifying portfolio data.
// ---------------------------------------------------------------------------
const TECH_HOLDING_PATTERN = /nvidia|tsmc|taiwan semi|apple|microsoft|alphabet|google|meta|amazon|samsung|intel|amd|qualcomm|broadcom|tech|semiconductor|chip/i

// For the tech10 preset, technology-identified holdings receive an amplified
// effective equity beta (1.4 — matching the Technology sector sensitivity),
// while non-tech equity holdings receive a muted equity beta (0.15) because
// a sector-specific shock transmits only weakly to unrelated sectors.
const TECH10_HOLDING_SENSITIVITY = {
  isTech:    { equity: 1.4,  rate: -0.08, fx: -0.20 },
  isNotTech: { equity: 0.15, rate: -0.02, fx: -0.05 },
}

function calcHoldingImpactPct(holdingName, assetClassLabel, weightPct, equity, rate, fx, preset) {
  // For the tech10 preset, override sensitivity based on tech-name detection.
  if (preset === 'tech10' && assetClassLabel === 'Equities') {
    const s = TECH_HOLDING_PATTERN.test(holdingName)
      ? TECH10_HOLDING_SENSITIVITY.isTech
      : TECH10_HOLDING_SENSITIVITY.isNotTech
    return (weightPct / 100) * (
      s.equity * (equity / 100) +
      s.rate   * (rate   / 100) +
      s.fx     * (fx     / 100)
    )
  }
  // All other presets: standard asset-class sensitivity (unchanged).
  return calcImpactPct(assetClassLabel, weightPct, equity, rate, fx)
}

export default function ScenarioLab() {
  const [clients,   setClients]   = useState(null)
  const [clientId,  setClientId]  = useState('all')
  const [portfolio, setPortfolio] = useState(null)
  const [equity,    setEquity]    = useState(-20)
  const [rate,      setRate]      = useState(0)
  const [fx,        setFx]        = useState(0)
  const [preset,    setPreset]    = useState('equity')

  // Load all clients once.
  useEffect(() => {
    getClients().then(setClients)
  }, [])

  // Load portfolio whenever a specific client is selected; clear on whole-book.
  useEffect(() => {
    if (clientId === 'all') {
      setPortfolio(null)
      return
    }
    getPortfolio(clientId).then(setPortfolio)
  }, [clientId])

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

  // ── Client-level results (unchanged logic, now uses shared helper) ────────
  const results = useMemo(() => {
    return scope.map((c) => {
      let pctImpact = 0
      for (const a of c.concentration) {
        pctImpact += calcImpactPct(a.label, a.pct, equity, rate, fx)
      }
      const value = c.aumChf * pctImpact
      return { id: c.id, name: c.name, pct: pctImpact * 100, value, aum: c.aumChf }
    })
  }, [scope, equity, rate, fx])

  // ── Holding-level results for single-client mode ─────────────────────────
  const holdingResults = useMemo(() => {
    if (clientId === 'all' || !portfolio?.topHoldings) return []
    const client = scope[0]
    if (!client) return []
    return portfolio.topHoldings.map((h) => {
      const pctImpact = calcHoldingImpactPct(h.name, h.assetClass, h.weight, equity, rate, fx, preset)
      const holdingValue = client.aumChf * (h.weight / 100)
      const impactValue  = client.aumChf * pctImpact
      return {
        name:        h.name,
        assetClass:  h.assetClass,
        weight:      h.weight,
        pct:         pctImpact * 100,
        value:       impactValue,
        holdingValue,
      }
    }).sort((a, b) => a.value - b.value) // most negative first
  }, [portfolio, scope, clientId, equity, rate, fx, preset])

  if (!clients) return <Loading label="Loading scenario model" />

  const totalImpact = results.reduce((s, r) => s + r.value, 0)
  const totalAum    = scope.reduce((s, c) => s + c.aumChf, 0)
  const totalPct    = totalAum ? (totalImpact / totalAum) * 100 : 0
  const chartData   = [...results].sort((a, b) => a.value - b.value)

  const isSingleClient = clientId !== 'all'
  const singleResult   = isSingleClient ? results[0] : null

  return (
    <div>
      <PageHeader
        eyebrow="Scenario Lab"
        title="Prepare for the conversation before it happens"
        subtitle="Model a market shock across the book or a single client, so you can speak to downside with specifics rather than reassurance."
      />

      <div className="scenario-grid">
        {/* ── Controls (unchanged) ── */}
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

          <Slider label="Equity markets" value={equity} min={-40} max={20}   suffix="%" onChange={(v) => { setEquity(v); setPreset('custom') }} />
          <Slider label="Interest rates" value={rate}   min={-100} max={200} suffix=" bps" onChange={(v) => { setRate(v); setPreset('custom') }} />
          <Slider label="USD vs CHF"     value={fx}     min={-20}  max={20}  suffix="%" onChange={(v) => { setFx(v); setPreset('custom') }} />

          <div className="row" style={{ gap: 8, marginTop: 10, fontSize: 12, color: 'var(--ink-muted)' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>A transparent sensitivity model. Assumptions are simplified for preparation, not valuation.</span>
          </div>
        </Card>

        {/* ── Results ── */}
        <div className="grid" style={{ gap: 20 }}>

          {/* ── Single-client summary (new, only shown when one client selected) ── */}
          {isSingleClient && singleResult && (
            <ClientScenarioSummary
              client={scope[0]}
              result={singleResult}
              holdingResults={holdingResults}
              equity={equity}
              rate={rate}
              fx={fx}
            />
          )}

          {/* ── Existing impact summary card (unchanged) ── */}
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
                {describeScenario(equity, rate, fx, preset)}
              </div>
            </div>
          </Card>

          {/* ── Existing bar chart (unchanged) ── */}
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

          {/* ── Existing talking points (unchanged) ── */}
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

// ---------------------------------------------------------------------------
// ClientScenarioSummary — shown only in single-client mode.
// Displays current vs projected portfolio value and most-affected holdings.
// ---------------------------------------------------------------------------
function ClientScenarioSummary({ client, result, holdingResults }) {
  const projectedValue = client.aumChf + result.value
  const isNeg = result.value < 0

  // Top 3 most-affected holdings: highest absolute CHF impact, negatives first.
  const top3 = holdingResults.slice(0, 3)

  return (
    <Card>
      <div className="card-head">
        <h3 style={{ fontSize: 15 }}>Client scenario summary</h3>
        <span className="muted" style={{ fontSize: 12.5 }}>{client.name}</span>
      </div>
      <div className="card-pad" style={{ paddingTop: 18 }}>

        {/* Current vs projected */}
        <div className="grid cols-2" style={{ gap: 12, marginBottom: 20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Current portfolio</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              {formatChf(client.aumChf)}
            </div>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Projected portfolio</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: isNeg ? 'var(--danger)' : 'var(--ok)' }}>
              {formatChf(projectedValue)}
            </div>
            <div style={{ fontSize: 13, marginTop: 4, color: isNeg ? 'var(--danger)' : 'var(--ok)', display: 'flex', alignItems: 'center', gap: 3 }}>
              {isNeg
                ? <ArrowDownRight size={14} />
                : <ArrowUpRight   size={14} />}
              {formatChf(result.value)} ({formatPct(result.pct, { sign: true })})
            </div>
          </div>
        </div>

        {/* Most affected holdings */}
        {top3.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Most affected holdings</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
              {top3.map((h) => (
                <div key={h.name} className="kv">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 1 }}>{h.assetClass} · {h.weight}% of portfolio</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: h.value < 0 ? 'var(--danger)' : 'var(--ok)' }}>
                      {h.value < 0 ? '' : '+'}{formatChf(h.value)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 1 }}>
                      {formatPct(h.pct, { sign: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Prototype disclaimer */}
            <div className="row" style={{ gap: 8, fontSize: 12, color: 'var(--ink-muted)', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Holding-level impacts are prototype deterministic estimates using simplified sensitivity
                assumptions. They are preparation aids for the RM, not investment recommendations or
                market forecasts.
              </span>
            </div>
          </>
        )}

        {/* Graceful fallback when no portfolio data is available */}
        {top3.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--ink-muted)', paddingTop: 4 }}>
            No holding detail available for this client.
          </div>
        )}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Existing helpers — unchanged
// ---------------------------------------------------------------------------
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

function describeScenario(equity, rate, fx, preset) {
  // Named tech scenario gets its own label so the badge is unambiguous.
  if (preset === 'tech10') return 'Technology sector −10% (prototype)'
  const parts = []
  if (equity !== 0) parts.push(`Equities ${equity > 0 ? '+' : ''}${equity}%`)
  if (rate !== 0)   parts.push(`Rates ${rate > 0 ? '+' : ''}${rate}bps`)
  if (fx !== 0)     parts.push(`USD ${fx > 0 ? '+' : ''}${fx}%`)
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
