import { useState } from 'react'
import { FlaskConical, Layers, TrendingDown, Target, ListChecks, AlertCircle } from 'lucide-react'
import { Card, Badge } from './ui.jsx'
import { EvidenceInspector, EvidenceButton } from './EvidenceInspector.jsx'

// ScenarioPanel — reusable, prop-driven rendering of a structured scenario /
// stress-test object supplied by the intelligence layer. It performs NO
// modelling itself: it presents what the engine provides.
//
// Props:
//   scenario {
//     id, name, kind, description,
//     affectedExposures:     [ { label, value } ],
//     portfolioImplications: [ string ],
//     objectiveImplications: [ string ],
//     assumptions:           [ string ],
//     uncertainty:           string,
//     evidence:              [ { label, value, source, snapshot, record } ]
//   }
//   client   optional { name }

export default function ScenarioPanel({ scenario, client }) {
  const [showEvidence, setShowEvidence] = useState(false)
  if (!scenario) return null

  return (
    <Card className="scenario-panel">
      {/* Explicit non-forecast banner */}
      <div className="scenario-banner">
        <FlaskConical size={15} />
        <span>Scenario / Stress test — not a forecast</span>
      </div>

      <div className="card-pad">
        <div className="row between wrap" style={{ gap: 10, marginBottom: 6 }}>
          <div>
            <div className="eyebrow">Scenario</div>
            <h3 className="serif" style={{ fontSize: 20, marginTop: 4 }}>{scenario.name}</h3>
          </div>
          {scenario.evidence?.length > 0 && (
            <EvidenceButton
              count={scenario.evidence.length}
              onClick={() => setShowEvidence(true)}
            />
          )}
        </div>

        {scenario.description && (
          <p className="soft" style={{ fontSize: 14, margin: '0 0 4px' }}>{scenario.description}</p>
        )}
        {client?.name && (
          <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>
            Applied to {client.name}
          </p>
        )}

        {/* Affected exposures */}
        {scenario.affectedExposures?.length > 0 && (
          <ScenarioBlock icon={<Layers size={14} />} title="Affected exposures">
            {scenario.affectedExposures.map((e) => (
              <div className="kv" key={e.label}>
                <span className="k">{e.label}</span>
                <span className="v">{e.value}</span>
              </div>
            ))}
          </ScenarioBlock>
        )}

        {/* Portfolio implications */}
        {scenario.portfolioImplications?.length > 0 && (
          <ScenarioBlock icon={<TrendingDown size={14} />} title="Portfolio implications">
            <ul className="scenario-list">
              {scenario.portfolioImplications.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </ScenarioBlock>
        )}

        {/* Objective implications */}
        {scenario.objectiveImplications?.length > 0 && (
          <ScenarioBlock icon={<Target size={14} />} title="Client-objective implications">
            <ul className="scenario-list">
              {scenario.objectiveImplications.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </ScenarioBlock>
        )}

        {/* Assumptions */}
        {scenario.assumptions?.length > 0 && (
          <ScenarioBlock icon={<ListChecks size={14} />} title="Assumptions">
            <ul className="scenario-list">
              {scenario.assumptions.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </ScenarioBlock>
        )}

        {/* Uncertainty — always explicit */}
        {scenario.uncertainty && (
          <div className="uncertainty" style={{ marginTop: 16 }}>
            <AlertCircle size={14} />
            <span><strong>Uncertainty:</strong> {scenario.uncertainty}</span>
          </div>
        )}
      </div>

      <EvidenceInspector
        open={showEvidence}
        onClose={() => setShowEvidence(false)}
        title={`${scenario.name} — evidence`}
        evidence={scenario.evidence || []}
      />
    </Card>
  )
}

function ScenarioBlock({ icon, title, children }) {
  return (
    <div className="scenario-block">
      <div className="eyebrow row" style={{ gap: 7, marginBottom: 8 }}>
        {icon} {title}
      </div>
      {children}
    </div>
  )
}
