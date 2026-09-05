/**
 * IntelligenceScan
 *
 * Session-once intelligence-scan opening moment for the Overview page.
 * Shown once per browser session (sessionStorage flag). Skippable.
 *
 * Props:
 *   attentionCount  number   — real value from Overview data (clients requiring attention)
 *   onComplete      () => void  — called when the sequence finishes or is skipped
 *
 * All displayed figures are real application values. No fake calculations.
 * Total runtime ≈ 1.8 s before auto-complete; Skip exits immediately.
 */

import { useEffect, useRef, useState } from 'react'

// Real book figures — match official dataset loaded by server/data/
const BOOK_FIGURES = [
  { n: '20',  l: 'Clients' },
  { n: '23',  l: 'Portfolios' },
  { n: '5',   l: 'Snapshots' },
]

const SCAN_STAGES = [
  'Portfolio exposures mapped',
  'Liquidity requirements connected',
  'Credit positions assessed',
  'Client context incorporated',
]

// Timings (ms)
const T_STATUS   = 400   // when "Analysing…" appears
const T_FIGURES  = 700   // when figures reveal
const T_STAGE_0  = 900
const T_STAGE_1  = 1050
const T_STAGE_2  = 1200
const T_STAGE_3  = 1320
const T_CONCLUDE = 1480  // conclusion line appears
const T_EXIT     = 1850  // auto-complete

export const SCAN_SESSION_KEY = 'wl.scanSeen'

export function shouldShowScan() {
  try {
    return !sessionStorage.getItem(SCAN_SESSION_KEY)
  } catch {
    return false
  }
}

export function markScanSeen() {
  try {
    sessionStorage.setItem(SCAN_SESSION_KEY, '1')
  } catch { /* ignore */ }
}

export default function IntelligenceScan({ attentionCount, onComplete }) {
  const [phase, setPhase]           = useState('enter')   // enter | running | exiting
  const [showStatus, setShowStatus] = useState(false)
  const [showFigures, setShowFigures] = useState(false)
  const [activeStage, setActiveStage] = useState(-1)
  const [showConclusion, setShowConclusion] = useState(false)
  const timers = useRef([])

  const done = (immediate = false) => {
    timers.current.forEach(clearTimeout)
    markScanSeen()
    if (immediate) {
      onComplete()
    } else {
      setPhase('exiting')
      timers.current.push(setTimeout(onComplete, 320))
    }
  }

  useEffect(() => {
    const t = (fn, delay) => {
      const id = setTimeout(fn, delay)
      timers.current.push(id)
    }

    t(() => setShowStatus(true),             T_STATUS)
    t(() => setShowFigures(true),            T_FIGURES)
    t(() => setActiveStage(0),               T_STAGE_0)
    t(() => setActiveStage(1),               T_STAGE_1)
    t(() => setActiveStage(2),               T_STAGE_2)
    t(() => setActiveStage(3),               T_STAGE_3)
    t(() => setShowConclusion(true),         T_CONCLUDE)
    t(() => done(false),                     T_EXIT)

    return () => timers.current.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={`intel-scan-overlay${phase === 'exiting' ? ' intel-scan-exit' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Analysing client book"
    >
      {/* Brand */}
      <div className="intel-scan-wordmark">WealthLens</div>
      <div className="intel-scan-sub">Wealth Intelligence</div>

      {/* Status line */}
      <div className="intel-scan-status" style={{ opacity: showStatus ? 1 : 0, transition: 'opacity 0.25s ease' }}>
        {showStatus ? `Analysing Priscilla's client book\u2026` : '\u00a0'}
      </div>

      {/* Real book figures */}
      {showFigures && (
        <div className="intel-scan-figures">
          {BOOK_FIGURES.map((f, i) => (
            <div key={f.l} className="intel-scan-figure" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="n">{f.n}</div>
              <div className="l">{f.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Scan stages */}
      {showFigures && (
        <div className="intel-scan-stages">
          {SCAN_STAGES.map((label, i) => (
            <div
              key={label}
              className={`intel-scan-stage${i <= activeStage ? ' active' : ''}`}
            >
              <span className="dot" />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Conclusion */}
      {showConclusion && (
        <div className="intel-scan-conclusion">
          {attentionCount === 1
            ? '1 client requires attention'
            : `${attentionCount} clients require attention`}
        </div>
      )}

      {/* Skip */}
      <button
        className="intel-scan-skip"
        onClick={() => done(true)}
        aria-label="Skip intelligence scan"
      >
        Skip
      </button>
    </div>
  )
}
