import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  Gauge,
  Activity,
  Target,
  Clock,
  FlaskConical,
  FileText,
  CheckCircle2,
  Check,
  Info,
  TrendingDown,
} from 'lucide-react'
import { Card, Badge, PriorityBadge, Loading } from '../components/ui.jsx'
import { getIntelligenceById, getClientById } from '../services/dataService.js'
import { formatMoney, formatPct, formatDate } from '../utils/format.js'

const FACTOR_ICONS = {
  'Portfolio Exposure': Gauge,
  'Market Impact': Activity,
  'Goal Sensitivity': Target,
  Urgency: Clock,
}

export default function IntelligenceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true })
  const [openEvidence, setOpenEvidence] = useState(0)
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    let active = true
    setState({ loading: true })
    getIntelligenceById(id).then((signal) => {
      if (!signal) {
        if (active) setState({ loading: false, signal: null })
        return
      }
      getClientById(signal.clientId).then((client) => {
        if (active) setState({ loading: false, signal, client })
      })
    })
    return () => {
      active = false
    }
  }, [id])

  if (state.loading) return <Loading label="Opening intelligence" />
  const { signal, client } = state
  if (!signal) {
    return (
      <div>
        <Link className="link-gold" to="/intelligence" style={{ display: 'inline-flex', marginBottom: 16 }}>
          <ArrowLeft size={15} /> All intelligence
        </Link>
        <Card className="empty">This intelligence item could not be found.</Card>
      </div>
    )
  }

  const impactNegative = signal.scenarioImpact != null && signal.scenarioImpact < 0

  return (
    <div>
      <Link className="link-gold" to="/intelligence" style={{ display: 'inline-flex', marginBottom: 16 }}>
        <ArrowLeft size={15} /> All intelligence
      </Link>

      {/* Header */}
      <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
        <PriorityBadge priority={signal.priority} />
        <Badge tone="neutral">{signal.category}</Badge>
        <span className="muted row" style={{ fontSize: 12.5, gap: 5 }}>
          <Clock size={13} /> {signal.horizon}
        </span>
        <span className="muted" style={{ fontSize: 12.5 }}>· Detected {formatDate(signal.createdAt)}</span>
      </div>

      <div className="idetail-head">
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 className="page-title" style={{ fontSize: 30 }}>{signal.headline}</h1>
          <div className="row wrap" style={{ gap: 8, marginTop: 12, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13.5 }}>For</span>
            <Link to={`/clients/${signal.clientId}`} className="idetail-client">
              {signal.clientName}
            </Link>
            {client && (
              <span className="muted" style={{ fontSize: 13 }}>
                · {client.riskProfile} Risk · Client {client.clientId}
              </span>
            )}
          </div>
        </div>

        {/* Relevance score dial */}
        <div className="relevance-dial">
          <ScoreRing value={signal.relevanceScore} />
          <div>
            <div className="eyebrow">Relevance Score</div>
            <div className="relevance-big">
              {signal.relevanceScore}
              <span className="relevance-unit"> / 100</span>
            </div>
            <div className="muted" style={{ fontSize: 12 }}>Client-specific, not market-wide</div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start', marginTop: 24 }}>
        {/* Left column: reasoning */}
        <div className="grid" style={{ gap: 20 }}>
          {/* Factor breakdown */}
          <Card>
            <div className="card-head"><h3>How this score is composed</h3></div>
            <div className="card-pad">
              {signal.relevanceFactors.map((f) => {
                const Icon = FACTOR_ICONS[f.label] || Gauge
                return (
                  <div className="factor" key={f.label}>
                    <div className="factor-top">
                      <span className="factor-label">
                        <Icon size={15} /> {f.label}
                      </span>
                      <span className="factor-score">{f.score}</span>
                    </div>
                    <div className="factor-track">
                      <span style={{ width: `${f.score}%`, background: scoreColor(f.score) }} />
                    </div>
                    {f.note && <div className="factor-note">{f.note}</div>}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* What Changed */}
          <Section title="What Changed">
            <p className="reasoning">{signal.whatChanged}</p>
          </Section>

          {/* Why This Client */}
          <Section title="Why This Client">
            <ul className="why-list">
              {signal.whyClient.map((w) => (
                <li key={w}>
                  <span className="why-dot" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Why It Matters */}
          <Section title="Why It Matters" accent>
            <p className="reasoning">{signal.whyItMatters}</p>
            {signal.scenarioImpact != null && (
              <div className={`impact-callout ${impactNegative ? 'neg' : 'pos'}`}>
                <TrendingDown size={16} />
                <span>
                  Modelled scenario impact:{' '}
                  <strong>
                    {signal.scenarioImpact > 0 ? '+' : ''}
                    {formatMoney(signal.scenarioImpact, { compact: false })}
                  </strong>
                </span>
              </div>
            )}
          </Section>

          {/* Evidence */}
          <Card>
            <div className="card-head">
              <h3>Evidence</h3>
              <span className="muted" style={{ fontSize: 12.5 }}>Traceable underlying data</span>
            </div>
            <div>
              {signal.evidence.map((e, i) => {
                const open = openEvidence === i
                return (
                  <div className="evidence-item" key={e.title}>
                    <button
                      className="evidence-head"
                      onClick={() => setOpenEvidence(open ? -1 : i)}
                      aria-expanded={open}
                    >
                      <span>
                        <span className="evidence-title">{e.title}</span>
                        {e.summary && <span className="evidence-summary">{e.summary}</span>}
                      </span>
                      <ChevronDown
                        size={18}
                        style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease', flexShrink: 0 }}
                      />
                    </button>
                    {open && e.rows && e.rows.length > 0 && (
                      <div className="evidence-body">
                        {e.rows.map((r) => (
                          <div className="evidence-row" key={r.label}>
                            <span className="k">{r.label}</span>
                            <span className="v">{r.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Right rail: preparation + actions */}
        <div className="grid" style={{ gap: 20 }}>
          <Card className="card-pad prep-card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Suggested RM Preparation</div>
            <p className="reasoning" style={{ marginTop: 0 }}>{signal.suggestedPreparation}</p>
            <div className="prep-disclaimer">
              <Info size={15} />
              <span>
                Decision support only. This is not investment advice and no action has been taken.
                The Relationship Manager remains responsible for the final decision and client interaction.
              </span>
            </div>
          </Card>

          <Card className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Actions</div>
            <div className="grid" style={{ gap: 10 }}>
              <button
                className="btn btn-primary"
                style={{ justifyContent: 'center' }}
                onClick={() => navigate(`/scenario-lab?client=${signal.clientId}`)}
              >
                <FlaskConical size={15} /> Simulate Scenario
              </button>
              <button
                className="btn"
                style={{ justifyContent: 'center' }}
                onClick={() => navigate('/briefings')}
              >
                <FileText size={15} /> Prepare Client Brief
              </button>
              <button
                className={`btn ${reviewed ? 'btn-reviewed' : ''}`}
                style={{ justifyContent: 'center' }}
                onClick={() => setReviewed((r) => !r)}
              >
                {reviewed ? <Check size={15} /> : <CheckCircle2 size={15} />}
                {reviewed ? 'Reviewed' : 'Mark Reviewed'}
              </button>
            </div>
          </Card>

          {client && (
            <Card className="card-pad">
              <div className="eyebrow" style={{ marginBottom: 12 }}>Client snapshot</div>
              <div className="kv">
                <span className="k">Portfolio value</span>
                <span className="v">{formatMoney(client.aumChf)}</span>
              </div>
              <div className="kv">
                <span className="k">Risk profile</span>
                <span className="v">{client.riskProfile}</span>
              </div>
              {signal.exposurePct != null && (
                <div className="kv">
                  <span className="k">Exposure concerned</span>
                  <span className="v">{formatPct(signal.exposurePct)}</span>
                </div>
              )}
              {client.liquidityRequirement && (
                <div className="kv">
                  <span className="k">Liquidity need</span>
                  <span className="v">
                    {formatMoney(client.liquidityRequirement.amount)} / {client.liquidityRequirement.months}m
                  </span>
                </div>
              )}
              <Link className="link-gold" to={`/clients/${client.id}`} style={{ marginTop: 12, display: 'inline-flex' }}>
                Open full profile
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, accent }) {
  return (
    <Card className="card-pad">
      <div className={`eyebrow${accent ? ' eyebrow-accent' : ''}`} style={{ marginBottom: 10 }}>{title}</div>
      {children}
    </Card>
  )
}

function ScoreRing({ value }) {
  const r = 30
  const c = 2 * Math.PI * r
  const offset = c * (1 - (value || 0) / 100)
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="score-ring">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke={scoreColor(value)}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 38 38)"
      />
      <text x="38" y="43" textAnchor="middle" className="score-ring-text">{value}</text>
    </svg>
  )
}

function scoreColor(v) {
  if (v >= 80) return 'var(--danger)'
  if (v >= 60) return 'var(--warn)'
  return 'var(--ok)'
}
