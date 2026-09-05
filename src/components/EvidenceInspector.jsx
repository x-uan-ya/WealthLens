import { useEffect } from 'react'
import { X, FileText, Database, Table, StickyNote, CalendarDays, Download } from 'lucide-react'

// EvidenceInspector — reusable, fully prop-driven evidence drawer.
//
// Traceability is a first-class requirement: for every claim the RM can inspect
// the metric, its value, the source record, and the snapshot date it came from.
//
// Props:
//   open        boolean — whether the drawer is visible
//   onClose     () => void
//   title       optional heading (e.g. the signal title)
//   evidence    [ { label, value, source, snapshot, record } ]  — REQUIRED, dynamic
//
// This component hard-codes NOTHING about specific clients or signals. It renders
// whatever evidence array it is given, grouped by source file for readability.

// Icon per known source file; falls back to a generic file icon.
const SOURCE_ICON = (source = '') => {
  const s = source.toLowerCase()
  if (s.endsWith('.json')) return StickyNote
  if (s.includes('credit') || s.includes('facilit')) return Database
  if (s.includes('event')) return CalendarDays
  if (s.endsWith('.csv')) return Table
  return FileText
}

export function EvidenceInspector({ open, onClose, title, evidence = [] }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // Export the evidence records as a CSV file (traceable, spreadsheet-friendly).
  const handleDownload = () => {
    if (!evidence.length) return
    const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Claim', 'Value', 'Source', 'Snapshot', 'Record']
    const rows = evidence.map((e) =>
      [e.label, e.value, e.source, e.snapshot, e.record].map(csvCell).join(',')
    )
    const csv = [header.map(csvCell).join(','), ...rows].join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeTitle = (title || 'evidence').replace(/[^\w-]+/g, '_').slice(0, 60)
    a.href = url
    a.download = `${safeTitle}_evidence.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Group evidence rows by their source file.
  const groups = evidence.reduce((acc, item) => {
    const key = item.source || 'Unattributed'
    ;(acc[key] = acc[key] || []).push(item)
    return acc
  }, {})

  return (
    <div className="evi-overlay" onClick={onClose}>
      <aside
        className="evi-drawer"
        role="dialog"
        aria-label="Evidence inspector"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="evi-head">
          <div>
            <div className="eyebrow">Evidence</div>
            <h3 style={{ fontSize: 16, marginTop: 4 }}>{title || 'Supporting records'}</h3>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {evidence.length > 0 && (
              <button
                className="btn btn-sm"
                onClick={handleDownload}
                title="Download evidence records as CSV"
              >
                <Download size={14} /> Download
              </button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close evidence">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="evi-body">
          {evidence.length === 0 ? (
            <div className="empty" style={{ padding: 32 }}>
              No evidence records attached to this item.
            </div>
          ) : (
            Object.entries(groups).map(([source, rows]) => {
              const Icon = SOURCE_ICON(source)
              return (
                <div className="evi-group" key={source}>
                  <div className="evi-source">
                    <Icon size={14} />
                    <span className="mono">{source}</span>
                  </div>
                  {rows.map((r, i) => (
                    <div className="evi-row" key={`${source}-${i}`}>
                      <div className="evi-claim">
                        <span className="evi-label">{r.label}</span>
                        {r.record && <span className="evi-record">{r.record}</span>}
                      </div>
                      <div className="evi-meta">
                        <span className="evi-value">{r.value}</span>
                        {r.snapshot && <span className="evi-snapshot">{r.snapshot}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </div>

        <div className="evi-foot">
          Every figure traces to a source record and snapshot date. Values are supplied by the
          data layer, not computed in the interface.
        </div>
      </aside>
    </div>
  )
}

// Small inline trigger button that opens the inspector. Optional convenience.
export function EvidenceButton({ count, onClick, label = 'View evidence' }) {
  return (
    <button className="btn btn-sm" onClick={onClick}>
      <FileText size={14} /> {label}
      {count != null && <span className="evi-count">{count}</span>}
    </button>
  )
}

export default EvidenceInspector
