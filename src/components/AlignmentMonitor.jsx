import { useState } from 'react'
import { ArrowRight, Scale, AlertTriangle } from 'lucide-react'
import { Card, Badge } from './ui.jsx'
import { EvidenceInspector, EvidenceButton } from './EvidenceInspector.jsx'

// AlignmentMonitor — reusable comparison of what a client SHOULD hold (profile,
// objective, mandate range) versus what they DO hold (portfolio reality), and
// the resulting alignment issue. Fully prop-driven from an intelligence signal;
// nothing about a specific client is hard-coded.
//
// Props:
//   signal   an intelligence signal, typically type MANDATE_BREACH or
//            OBJECTIVE_CONTRADICTION, with verifiedMetrics + evidence.
//   client   optional { name, riskProfile, lifeStage }
//   context  optional extra rows: [ { label, value } ] (e.g. cash needs, life event)
//
// The component reads verifiedMetrics by convention where possible, but is
// defensive: it renders whatever is present.

// Heuristic classification of a verified-metric label into the three columns.
const classify = (label = '') => {
  const l = label.toLowerCase()
  if (/status|out of band|breach|alignment/.test(l)) return 'verdict'
  if (/current|actual|portfolio|exposure|holding/.test(l)) return 'reality'
  return 'expectation' // profile / objective / mandate range
}

export default function AlignmentMonitor({ signal, client, context = [] }) {
  const [showEvidence, setShowEvidence] = useState(false)
  if (!signal) return null

  const metrics = signal.verifiedMetrics || []
  const expectation = metrics.filter((m) => classify(m.label) === 'expectation')
  const reality = metrics.filter((m) => classify(m.label) === 'reality')
  const verdict = metrics.find((m) => classify(m.label) === 'verdict')

  const outOfBand =
    verdict && /out of band|breach|misalign/i.test(String(verdict.value))

  return (
    <Card className="alignment-monitor">
      <div className="card-head">
        <div className="row" style={{ gap: 9 }}>
          <Scale size={17} color="var(--gold)" />
          <h3>Client Alignment Monitor</h3>
        </div>
        {signal.evidence?.length > 0 && (
          <EvidenceButton count={signal.evidence.length} onClick={() => setShowEvidence(true)} />
        )}
      </div>

      <div className="card-pad">
        <div className="alignment-flow">
          {/* Column 1 — profile / objective / mandate */}
          <div className="align-col">
            <div className="align-col-head">Client profile &amp; objective</div>
            {client?.riskProfile && (
              <div className="align-row">
                <span className="k">Risk profile</span>
                <span className="v">{client.riskProfile}</span>
              </div>
            )}
            {expectation.map((m) => (
              <div className="align-row" key={m.label}>
                <span className="k">{m.label}</span>
                <span className="v">{m.value}</span>
              </div>
            ))}
          </div>

          <div className="align-arrow"><ArrowRight size={18} /></div>

          {/* Column 2 — portfolio reality */}
          <div className="align-col">
            <div className="align-col-head">Portfolio reality</div>
            {reality.length ? (
              reality.map((m) => (
                <div className="align-row" key={m.label}>
                  <span className="k">{m.label}</span>
                  <span className="v">{m.value}</span>
                </div>
              ))
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>Awaiting portfolio figures.</div>
            )}
          </div>

          <div className="align-arrow"><ArrowRight size={18} /></div>

          {/* Column 3 — alignment verdict */}
          <div className={`align-col align-verdict${outOfBand ? ' issue' : ''}`}>
            <div className="align-col-head">Alignment</div>
            <div className="align-verdict-badge">
              {outOfBand && <AlertTriangle size={15} />}
              <span>{verdict?.value || (outOfBand ? 'Out of band' : 'Review')}</span>
            </div>
            <p className="soft" style={{ fontSize: 13, margin: '10px 0 0' }}>{signal.summary}</p>
          </div>
        </div>

        {/* Additional context rows (cash needs, life event) */}
        {context.length > 0 && (
          <div className="align-context">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Why it matters beyond the breach</div>
            {context.map((c) => (
              <div className="kv" key={c.label}>
                <span className="k">{c.label}</span>
                <span className="v">{c.value}</span>
              </div>
            ))}
          </div>
        )}

        {signal.uncertainty && (
          <div className="uncertainty" style={{ marginTop: 14 }}>
            <AlertTriangle size={14} />
            <span><strong>Uncertainty:</strong> {signal.uncertainty}</span>
          </div>
        )}
      </div>

      <EvidenceInspector
        open={showEvidence}
        onClose={() => setShowEvidence(false)}
        title={`${signal.title} — evidence`}
        evidence={signal.evidence || []}
      />
    </Card>
  )
}
