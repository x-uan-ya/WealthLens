import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FlaskConical, Info, ArrowLeft, Sparkles } from 'lucide-react'
import { PageHeader, Card, Badge, Loading } from '../components/ui.jsx'
import ScenarioPanel from '../components/ScenarioPanel.jsx'
import { getClientIntelligence, getOfficialClientById } from '../services/dataService.js'

// Scenario Lab is scoped to the three presentation clients for this prototype.
// Each has a real, deterministic backend scenario built from verified data.
const SUPPORTED_SCENARIO_CLIENTS = ['CL-0014', 'CL-0019', 'CL-0003']

// Human-readable scenario titles per client (for the selector + headings).
const SCENARIO_TITLES = {
  'CL-0019': 'Hormuz Re-escalation Stress Test',
  'CL-0014': 'Property & Liquidity Stress Test',
  'CL-0003': 'Suitability & Liquidity Stress Test',
}

export default function ScenarioLab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('client') || ''

  const [supportedClients, setSupportedClients] = useState(null) // [{id,name}]
  const [state, setState] = useState({ loading: false })

  // Load the labels for the supported clients (for the selector).
  useEffect(() => {
    let active = true
    Promise.all(SUPPORTED_SCENARIO_CLIENTS.map((id) => getOfficialClientById(id)))
      .then((clients) => {
        if (!active) return
        setSupportedClients(
          clients
            .filter(Boolean)
            .map((c) => ({ id: c.id, name: c.name }))
        )
      })
    return () => {
      active = false
    }
  }, [])

  // Load the selected client's intelligence + scenario.
  useEffect(() => {
    if (!selectedId) {
      setState({ loading: false })
      return
    }
    let active = true
    setState({ loading: true })
    Promise.all([getClientIntelligence(selectedId), getOfficialClientById(selectedId)])
      .then(([intel, client]) => {
        if (!active) return
        setState({ loading: false, intel, client })
      })
      .catch(() => {
        if (active) setState({ loading: false, error: true })
      })
    return () => {
      active = false
    }
  }, [selectedId])

  const selectClient = (id) => {
    if (id) setSearchParams({ client: id })
    else setSearchParams({})
  }

  const isSupported = SUPPORTED_SCENARIO_CLIENTS.includes(selectedId)
  const scenarios = state.intel?.scenarios || []

  return (
    <div>
      <PageHeader
        eyebrow="Scenario Lab"
        title="Prepare for the conversation before it happens"
        subtitle="Stress-test a client portfolio against a defined market scenario and understand which exposures matter, what assumptions were used, and how the outcome could shape the RM conversation."
        actions={
          <span className="scenario-gov-label" title="Scenario results are modelled estimates based on stated assumptions and verified portfolio data. They are intended to support RM preparation, not predict future market outcomes.">
            <FlaskConical size={13} /> Scenario / Stress Test — Not a Forecast
          </span>
        }
      />

      {/* Governance note */}
      <div className="scenario-gov-note">
        <Info size={14} />
        <span>
          Scenario results are modelled estimates based on stated assumptions and verified
          portfolio data. They are intended to support RM preparation, not predict future market
          outcomes.
        </span>
      </div>

      {/* Client selector */}
      <Card className="card-pad" style={{ marginBottom: 24, maxWidth: 460 }}>
        <label className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Client</label>
        <select
          value={selectedId}
          onChange={(e) => selectClient(e.target.value)}
          style={selectStyle}
        >
          <option value="">Select a client…</option>
          {(supportedClients || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {SCENARIO_TITLES[c.id]}
            </option>
          ))}
        </select>
      </Card>

      {/* Body */}
      {!selectedId && (
        <Card className="empty" style={{ padding: 48 }}>
          Select a client above to run their scenario stress test.
        </Card>
      )}

      {selectedId && state.loading && <Loading label="Running scenario" />}

      {selectedId && !state.loading && !isSupported && (
        <FutureCapability clientName={state.client?.name} clientId={selectedId} />
      )}

      {selectedId && !state.loading && isSupported && (
        <>
          {/* Back to this client's intelligence */}
          <Link
            className="link-gold"
            to={`/intelligence/${selectedId}`}
            style={{ display: 'inline-flex', marginBottom: 16 }}
          >
            <ArrowLeft size={15} /> Back to {state.client?.name || 'Client'} Intelligence
          </Link>

          {scenarios.length === 0 ? (
            <FutureCapability clientName={state.client?.name} clientId={selectedId} />
          ) : (
            <div className="grid" style={{ gap: 20 }}>
              {scenarios.map((sc) => (
                <ScenarioPanel key={sc.id} scenario={sc} client={state.client} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Future Capability — polished empty/future state for unsupported clients.
// Not an error; a deliberate "coming soon" positioning.
// ---------------------------------------------------------------------------
function FutureCapability({ clientName, clientId }) {
  return (
    <Card className="card-pad future-capability">
      <div className="future-icon">
        <Sparkles size={20} />
      </div>
      <div className="row" style={{ gap: 8, justifyContent: 'center', marginBottom: 6 }}>
        <Badge tone="gold">Future capability</Badge>
      </div>
      <h3 className="serif" style={{ fontSize: 19, textAlign: 'center', margin: '0 0 8px' }}>
        Scenario modelling for {clientName || 'this client'} is not yet available in the prototype.
      </h3>
      <p className="muted" style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto', fontSize: 14, lineHeight: 1.6 }}>
        WealthLens is designed to extend scenario intelligence across the RM&rsquo;s full client
        book. Additional client-specific models would be added as the intelligence library
        expands.
      </p>
      {clientId && (
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Link className="link-gold" to={`/intelligence/${clientId}`} style={{ display: 'inline-flex' }}>
            <ArrowLeft size={15} /> Back to client intelligence
          </Link>
        </div>
      )}
    </Card>
  )
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
