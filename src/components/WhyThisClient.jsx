// WhyThisClient — reusable, data-driven reasoning panel.
//
// Consumes a contract-shaped intelligence object and (optionally) the client.
// Renders WHY the situation is relevant to this specific client: the reasoning
// chain, the client-relevance score, and the contributing relevance factors.
//
// Props:
//   intelligence  {
//     priority,               // "HIGH" | "MEDIUM" | "LOW" | "NONE"
//     relevanceScore,         // 0..100 — the relevance to THIS client
//     relevanceFactors: [ { label, score, note } ],
//     signals: [ { type, severity, title, summary, verifiedMetrics, uncertainty } ],
//     rmContext: [ { date, note, author } ],
//     confidence,             // OPTIONAL, engine confidence — a SEPARATE concept
//   }
//   client        { name, riskProfile, lifeStage, objectives?, domicile? }
//
// IMPORTANT: Relevance and Confidence are different concepts. The client
// relevance score is read directly from intelligence.relevanceScore and is
// NEVER derived from confidence. Confidence, if supplied, is shown separately
// and clearly labelled.

import { PieChart, Shield, Target, NotebookPen, Clock, ChevronDown } from 'lucide-react'
import { Card } from './ui.jsx'

const PRIORITY_LABEL = {
  HIGH: 'High — requires attention',
  MEDIUM: 'Medium — monitor closely',
  LOW: 'Low — review next cycle',
  NONE: 'No immediate action',
}
const PRIORITY_COLOR = {
  HIGH: 'var(--danger)',
  MEDIUM: 'var(--warn)',
  LOW: 'var(--ok)',
  NONE: 'var(--ink-muted)',
}

export default function WhyThisClient({ intelligence, client }) {
  if (!intelligence) return null

  const {
    priority = 'NONE',
    relevanceScore = null,
    relevanceFactors = [],
    signals = [],
    confidence = null,
  } = intelligence

  const topSignal = signals[0] || null
  // The primary exposure/claim line for the reasoning chain (verified metric,
  // else the signal summary). Never fabricated here.
  const exposureNote =
    topSignal?.verifiedMetrics?.[0]
      ? `${topSignal.verifiedMetrics[0].label}: ${topSignal.verifiedMetrics[0].value}`
      : topSignal?.summary || null

  const objectives = client?.objectives || null

  return (
    <Card>
      <div className="card-head">
        <h3 className="serif" style={{ fontSize: 17 }}>Why this client?</h3>
        <span className="eyebrow" style={{ letterSpacing: '0.1em' }}>Reasoning flow</span>
      </div>

      <div className="card-pad" style={{ paddingTop: 20 }}>
        {/* ── Reasoning chain ─────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          {topSignal && (
            <>
              <ReasoningStep
                icon={<PieChart size={15} strokeWidth={2} />}
                label={humanType(topSignal.type)}
                value={exposureNote ?? topSignal.title}
              />
              <StepConnector />
            </>
          )}

          {client?.riskProfile && (
            <>
              <ReasoningStep
                icon={<Shield size={15} strokeWidth={2} />}
                label="Client risk profile"
                value={client.riskProfile}
                chip
              />
              <StepConnector />
            </>
          )}

          {objectives?.length ? (
            <>
              <ReasoningStep icon={<Target size={15} strokeWidth={2} />} label="Objectives">
                <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {objectives.map((o) => (
                    <li key={o} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: 'var(--ink-soft)', alignItems: 'flex-start' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold-soft)', flexShrink: 0, marginTop: 6 }} />
                      {o}
                    </li>
                  ))}
                </ul>
              </ReasoningStep>
              <StepConnector />
            </>
          ) : client?.lifeStage ? (
            <>
              <ReasoningStep
                icon={<Target size={15} strokeWidth={2} />}
                label="Client context"
                value={client.lifeStage}
              />
              <StepConnector />
            </>
          ) : null}

          {intelligence.rmContext?.length > 0 && (
            <>
              <ReasoningStep
                icon={<NotebookPen size={15} strokeWidth={2} />}
                label="RM context"
                value={intelligence.rmContext[0].note}
              />
              <StepConnector />
            </>
          )}

          <ReasoningStep icon={<Clock size={15} strokeWidth={2} />} label="Priority">
            <div style={{ marginTop: 6 }}>
              <span style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: PRIORITY_COLOR[priority] ?? 'var(--ink)',
                background: 'var(--surface-2)',
                border: `1px solid ${PRIORITY_COLOR[priority] ?? 'var(--line)'}`,
                borderRadius: 30,
                padding: '3px 10px',
              }}>
                {PRIORITY_LABEL[priority] ?? priority}
              </span>
            </div>
          </ReasoningStep>
        </div>

        {/* ── Client relevance score (NOT confidence) ─────────────── */}
        {relevanceScore != null && (
          <div style={{
            background: 'linear-gradient(160deg, var(--primary) 0%, #123647 100%)',
            borderRadius: 'var(--radius-sm)',
            padding: '20px 22px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(200,162,74,0.85)', fontWeight: 600, marginBottom: 6 }}>
                Client relevance score
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 48, fontWeight: 600, color: '#fff', lineHeight: 1, letterSpacing: '-0.03em' }}>
                {relevanceScore}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(234,240,242,0.55)', marginTop: 4 }}>out of 100</div>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(234,240,242,0.65)', lineHeight: 1.55 }}>
                How relevant this development is to <strong style={{ color: '#fff' }}>{client?.name || 'this client'}</strong>,
                given their portfolio, profile and objectives. The RM determines whether and how to act.
              </p>
              {confidence != null && (
                <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'rgba(234,240,242,0.5)', lineHeight: 1.5 }}>
                  Engine confidence: {Math.round(confidence * 100)}% — a separate measure of how
                  certain the engine is about the underlying signals, not a measure of relevance.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Relevance factors ───────────────────────────────────── */}
        {relevanceFactors.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Relevance factors</div>
            <div className="grid cols-2" style={{ gap: 10, marginBottom: 14 }}>
              {relevanceFactors.map((f) => (
                <FactorTile key={f.label} label={f.label} score={f.score} note={f.note} />
              ))}
            </div>
          </>
        )}

        <p style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--ink-muted)',
          lineHeight: 1.55,
          borderTop: '1px solid var(--line)',
          paddingTop: 14,
        }}>
          Relevance factors show how portfolio exposure, market context and client circumstances
          combine to prioritise attention. They are decision support, not investment
          recommendations. The Relationship Manager remains responsible for the final decision.
        </p>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function humanType(type = '') {
  return type
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
}

function ReasoningStep({ icon, label, value, chip, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'var(--primary-tint)',
        color: 'var(--primary)',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, paddingTop: 4, paddingBottom: 8 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
        {value && !chip && (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{value}</p>
        )}
        {value && chip && (
          <span style={{
            display: 'inline-block',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--primary)',
            background: 'var(--primary-tint)',
            borderRadius: 30,
            padding: '3px 10px',
            border: '1px solid var(--line)',
          }}>
            {value}
          </span>
        )}
        {children}
      </div>
    </div>
  )
}

function StepConnector() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '2px 0' }}>
      <div style={{ width: 32, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <ChevronDown size={16} strokeWidth={2} style={{ color: 'var(--gold-soft)' }} />
      </div>
    </div>
  )
}

function FactorTile({ label, score, note }) {
  return (
    <div style={{
      padding: '13px 15px',
      background: 'var(--surface-2)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-sm)',
    }}>
      <div style={{
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ink-muted)',
        fontWeight: 600,
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--primary)',
          lineHeight: 1,
        }}>
          {score}
        </div>
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ width: `${score}%`, height: '100%', background: 'var(--primary)', borderRadius: 3 }} />
        </div>
      </div>
      {note && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 7, lineHeight: 1.4 }}>{note}</div>
      )}
    </div>
  )
}
