import { Link } from 'react-router-dom'
import { ArrowRight, ShieldAlert } from 'lucide-react'
import { Badge } from './ui.jsx'
import { initialsOf } from '../utils/format.js'

// Reusable RM-attention card. Fully prop-driven — it renders whatever client +
// intelligence summary it is given, so real intelligence objects can flow in
// without changing this component.
//
// Props:
//   client       { id, name, riskProfile, domicile, lifeStage, presentation }
//   intelligence optional summary: { priority, priorityScore, relevanceScore,
//                topSignalTitle } — omit until the engine supplies it.
//   rank         optional 1-based position, shown as a numbered marker.

const PRIORITY_TONE = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low', NONE: 'neutral' }
const PRIORITY_LABEL = { HIGH: 'High priority', MEDIUM: 'Monitor', LOW: 'Low', NONE: 'No action' }

export default function PriorityClientCard({ client, intelligence, rank }) {
  const priority = intelligence?.priority || client.priority || 'NONE'
  const tone = PRIORITY_TONE[priority] || 'neutral'

  return (
    <Link to={`/clients/${client.id}`} className="card priority-client-card" data-priority={priority}>
      <div className="pcc-accent" data-priority={priority} />
      <div className="pcc-body">
        <div className="pcc-top">
          {rank != null && <span className="pcc-rank">{rank}</span>}
          <span className="avatar-lg" style={{ width: 40, height: 40, fontSize: 13.5 }}>
            {initialsOf(client.name)}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="row between" style={{ gap: 8 }}>
              <span className="pcc-name">{client.name}</span>
              <Badge tone={tone}>{PRIORITY_LABEL[priority] || priority}</Badge>
            </div>
            <div className="pcc-meta">
              {client.id} · {client.riskProfile} · {client.domicile}
            </div>
          </div>
        </div>

        {/* Intelligence summary — only when supplied by the engine */}
        {intelligence?.topSignalTitle && (
          <div className="pcc-signal">
            <ShieldAlert size={14} />
            <span>{intelligence.topSignalTitle}</span>
          </div>
        )}

        <div className="pcc-foot">
          {intelligence?.relevanceScore != null && (
            <span className="pcc-metric">
              Relevance <strong>{intelligence.relevanceScore}</strong>/100
            </span>
          )}
          {intelligence?.priorityScore != null && (
            <span className="pcc-metric">
              Priority <strong>{intelligence.priorityScore}</strong>
            </span>
          )}
          <span className="link-gold" style={{ marginLeft: 'auto', fontSize: 12.5 }}>
            Review <ArrowRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  )
}
