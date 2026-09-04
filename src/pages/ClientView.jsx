// ClientView — Page 8.
// A simplified, client-facing view of a WealthLens intelligence update.
// Designed to support a conversation with the Relationship Manager.
//
// This page is intentionally simpler than the RM interface:
//   - no relevance scores, confidence values, or prototype factor tiles
//   - no CHF scenario-loss figures or risk-threshold language
//   - no RM-internal evidence items
//   - no trading language or autonomous recommendations
//
// The visual story: what happened → how it may affect your portfolio →
// speak to your RM.

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loading } from '../components/ui.jsx'
import {
  getOfficialClientById,
  getClientBrief,
  getBriefStatus,
  getOfficialRm,
} from '../services/dataService.js'
import { initialsOf } from '../utils/format.js'

export default function ClientView() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let active = true
    setState({ loading: true })
    Promise.all([
      getOfficialClientById(id),
      getClientBrief(id),
      getBriefStatus(id),
      getOfficialRm(),
    ]).then(([client, brief, briefStatus, rm]) => {
      if (active) setState({ loading: false, client, brief, briefStatus, rm })
    })
    return () => { active = false }
  }, [id])

  if (state.loading) return (
    <div style={fullPageCenter}>
      <Loading label="Preparing your update" />
    </div>
  )

  const { client, brief, briefStatus, rm } = state

  if (!client) return (
    <div style={fullPageCenter}>
      <p style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)' }}>
        No information found for this client.
      </p>
    </div>
  )

  // Gate: the client-facing view only appears once the RM has reviewed and
  // marked the brief ready. Until then, nothing client-facing is shown.
  if (briefStatus !== 'ready' || !brief) {
    return (
      <div style={fullPageCenter}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <div style={{ ...brandMarkStyle, margin: '0 auto 16px' }}>
            <svg width="16" height="16" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="8" fill="none" stroke="#c8a24a" strokeWidth="2" />
              <circle cx="16" cy="16" r="2.6" fill="#c8a24a" />
            </svg>
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', marginBottom: 8 }}>
            Nothing to share yet
          </h2>
          <p style={{ color: 'var(--ink-muted)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            This client-facing update becomes available once your Relationship Manager has
            reviewed and marked the brief ready.
          </p>
          <Link className="link-gold" to={`/intelligence/${id}`} style={{ marginTop: 18, display: 'inline-flex' }}>
            Back to intelligence
          </Link>
        </div>
      </div>
    )
  }

  const rmName    = rm?.name  ?? 'Your Relationship Manager'
  const rmTitle   = rm?.title ?? 'Relationship Manager'
  const rmEmail   = rm?.email ?? null
  const rmInitials = initialsOf(rm?.name ?? '')

  return (
    <div style={pageStyle} className="client-view-page">

      {/* Page-scoped responsive CSS to adjust desktop layout only for this page */}
      <style>{`
        .client-view-page{width:90vw;max-width:1200px;margin:0 auto}
        .cards-wrap{width:100%}
        .cards-wrap .section-card{display:flex;flex-direction:column;width:100%}
        .contact-btn{display:inline-flex}
        /* readable text blocks inside cards */
        .client-view-page .section-card p{max-width:680px}

        @media (min-width:800px){
          .cards-wrap{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;align-items:stretch}
          .cards-wrap .card-full{grid-column:1 / -1}
          /* Dark card internal layout: give the explanation substantially more width */
          .third-card .third-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:start}
          .third-card .third-left{padding-right:12px;min-width:260px}
          .third-card .third-right{display:flex;flex-direction:column;align-items:flex-end;gap:18px;min-width:220px}
          .third-card .rm-chip-wrapper{width:100%;max-width:360px}
          .contact-btn{width:auto}
        }

        /* Desktop >=1000px: wider main container and two-column composition */
        @media (min-width:1000px){
          .client-view-page{width: calc(100vw - 96px); max-width: 1540px; margin-left: auto; margin-right: auto}
          .brand-strip{margin-bottom:12px}
          .hero-block{margin-bottom:12px}
          .content-grid{width:100%; display:grid; grid-template-columns: minmax(0,1.55fr) minmax(380px,0.85fr); gap:32px; align-items:start}
          .content-grid .left-col{display:flex;flex-direction:column;gap:24px}
          /* ensure columns and cards fully occupy available width */
          .left-col, .right-col, .section-card, .cards-wrap, .third-card{max-width:none;width:100%}
          .content-grid .right-col .section-card{height:100%}
        }

        @media (max-width:799px){
          .client-view-page{width:calc(100% - 32px)}
          .cards-wrap{display:flex;flex-direction:column}
          .contact-btn{width:100%}
          .third-card .third-grid{display:block}
          .content-grid{display:block}
        }
      `}</style>

      {/* ── Brand strip ── */}
      <div style={brandStripStyle} className="brand-strip">
        <div style={brandMarkStyle}>
          <svg width="16" height="16" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="8" fill="none" stroke="#c8a24a" strokeWidth="2" />
            <circle cx="16" cy="16" r="2.6" fill="#c8a24a" />
          </svg>
        </div>
        <div style={brandNameStyle}>WealthLens</div>
        <div style={dividerDotStyle}>·</div>
        <div style={brandSubStyle}>Private Client View</div>
      </div>

      {/* ── Hero ── */}
      <div style={heroStyle} className="hero-block">
        <div style={clientAvatarStyle}>{initialsOf(client.name)}</div>
        <h1 style={heroNameStyle}>{client.name}</h1>
        <p style={heroSubStyle}>
          An update prepared to support your conversation with your Relationship Manager.
        </p>
      </div>

      {/* ── Main content grid (left: stacked cards, right: dark RM card) ── */}
      <div className="content-grid" style={{ width: '100%' }}>
        <div className="left-col">
          {/* Section 1 — What happened (from the approved brief) */}
          <div style={sectionCardStyle} className="section-card">
            <div style={questionLabelStyle}>What happened?</div>
            <p style={answerStyle}>{brief.situation}</p>
          </div>

          {/* Section 2 — Why this may matter to you */}
          <div style={sectionCardStyle} className="section-card">
            <div style={questionLabelStyle}>Why this may matter to you</div>
            <p style={answerStyle}>{brief.whyItMatters}</p>
          </div>
        </div>

        <div className="right-col">
          {/* Section 3 — What should I do (dark RM card) */}
          <div style={{ ...sectionCardStyle, borderColor: 'rgba(200,162,74,0.25)', background: 'linear-gradient(160deg, #0f2e40, #0a232f)' }} className="section-card third-card">
            <div style={{ ...questionLabelStyle, color: 'rgba(200,162,74,0.9)' }}>What should I do?</div>

            <div className="third-grid" style={{ marginTop: 6 }}>
              <div className="third-left">
                <p style={{ ...answerStyle, color: 'rgba(234,240,242,0.88)' }}>
                  Your Relationship Manager can help you review whether your current positioning
                  continues to align with your goals and upcoming liquidity needs.
                </p>
              </div>

              <div className="third-right">
                <div style={{ marginTop: 0 }}>
                  {rmEmail ? (
                    <a
                      href={`mailto:${rmEmail}`}
                      style={contactBtnStyle}
                      className="contact-btn"
                    >
                      Contact {rmName}
                    </a>
                  ) : (
                    <button style={contactBtnStyle} className="contact-btn">
                      Contact {rmName}
                    </button>
                  )}
                </div>

                <div className="rm-chip-wrapper" style={{ width: '100%' }}>
                  <div style={rmChipStyle}>
                    <div style={rmAvatarStyle}>{rmInitials}</div>
                    <div>
                      <div style={rmNameLineStyle}>{rmName}</div>
                      <div style={rmTitleLineStyle}>{rmTitle}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Supporting copy ── */}
      <p style={supportingCopyStyle}>
        WealthLens helps your Relationship Manager identify information that may be relevant
        to your circumstances. Your Relationship Manager remains responsible for discussing
        the appropriate next steps with you.
      </p>

      {/* ── Legal footer ── */}
      <div style={footerStyle}>
        This view is intended to support a conversation with your Relationship Manager.
        It does not constitute investment advice.
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles — all inline, scoped to this component, no global CSS changes.
// Uses existing WealthLens design tokens via CSS custom properties.
// ---------------------------------------------------------------------------

const fullPageCenter = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  background: 'var(--paper)',
}

const pageStyle = {
  minHeight: '100vh',
  background: 'var(--paper)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '40px 24px 80px',
  fontFamily: 'var(--font-sans)',
}

const brandStripStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 48,
}

const brandMarkStyle = {
  width: 28,
  height: 28,
  borderRadius: 7,
  background: 'linear-gradient(160deg, #123647, #0a222f)',
  border: '1px solid rgba(200,162,74,0.35)',
  display: 'grid',
  placeItems: 'center',
}

const brandNameStyle = {
  fontFamily: 'var(--font-serif)',
  fontSize: 17,
  fontWeight: 600,
  color: 'var(--ink)',
  letterSpacing: '-0.02em',
}

const dividerDotStyle = {
  color: 'var(--ink-muted)',
  fontSize: 14,
}

const brandSubStyle = {
  fontSize: 12,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
  fontWeight: 600,
}

const heroStyle = {
  textAlign: 'center',
  marginBottom: 48,
  maxWidth: 540,
}

const clientAvatarStyle = {
  width: 64,
  height: 64,
  borderRadius: '50%',
  background: 'var(--primary)',
  color: 'var(--gold-soft)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: '0.02em',
  margin: '0 auto 20px',
}

const heroNameStyle = {
  fontFamily: 'var(--font-serif)',
  fontSize: 34,
  fontWeight: 600,
  letterSpacing: '-0.025em',
  color: 'var(--ink)',
  margin: '0 0 12px',
}

const heroSubStyle = {
  fontSize: 15,
  color: 'var(--ink-muted)',
  lineHeight: 1.6,
  margin: 0,
}

const cardsWrapStyle = {
  width: '100%',
  maxWidth: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  marginBottom: 32,
}

const sectionCardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-lg)',
  padding: '28px 32px',
  boxShadow: 'var(--shadow-sm)',
}

const questionLabelStyle = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
  marginBottom: 14,
}

const answerStyle = {
  fontFamily: 'var(--font-serif)',
  fontSize: 19,
  lineHeight: 1.55,
  color: 'var(--ink)',
  margin: 0,
  fontWeight: 500,
  letterSpacing: '-0.01em',
}

const contactBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--gold)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '13px 28px',
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: '0.01em',
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  textDecoration: 'none',
}

const rmChipStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginTop: 20,
  paddingTop: 20,
  borderTop: '1px solid rgba(255,255,255,0.1)',
}

const rmAvatarStyle = {
  width: 38,
  height: 38,
  borderRadius: '50%',
  background: 'rgba(200,162,74,0.18)',
  color: 'var(--gold-soft)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 13,
  fontWeight: 700,
  flexShrink: 0,
}

const rmNameLineStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: '#fff',
}

const rmTitleLineStyle = {
  fontSize: 12,
  color: 'rgba(234,240,242,0.55)',
  marginTop: 1,
}

const supportingCopyStyle = {
  maxWidth: 540,
  fontSize: 13,
  color: 'var(--ink-muted)',
  lineHeight: 1.6,
  textAlign: 'center',
  margin: '0 0 40px',
}

const footerStyle = {
  fontSize: 12,
  color: 'var(--ink-muted)',
  textAlign: 'center',
  width: '100%',
  maxWidth: '100%',
  lineHeight: 1.5,
  paddingTop: 24,
  borderTop: '1px solid var(--line)',
}
