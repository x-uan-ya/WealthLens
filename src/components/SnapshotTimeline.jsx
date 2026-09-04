import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

// SnapshotTimeline — reusable historical snapshot visualisation.
//
// Renders values supplied by the intelligence/data layer across the five
// official snapshot dates. The frontend performs NO financial calculation:
// it only displays the numbers it is given. The first/last figures shown are
// the supplied endpoint values, not computed results.
//
// Props:
//   history {
//     dates:  [ '2025-12-31', '2026-02-27', '2026-03-31', '2026-06-30', '2026-08-26' ],
//     series: [ { label, unit, values: [ ...one per date ] } ]
//   }
//   title   optional heading

const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

const withUnit = (v, unit) => {
  if (v == null) return '—'
  if (!unit) return `${v}`
  return unit === '%' ? `${v}%` : `${v} ${unit}`
}

export default function SnapshotTimeline({ history, title = 'Historical snapshots' }) {
  if (!history?.dates?.length || !history?.series?.length) {
    return null
  }

  const { dates, series } = history

  return (
    <div className="card">
      <div className="card-head">
        <h3>{title}</h3>
        <span className="muted" style={{ fontSize: 12.5 }}>
          {dates.length} official snapshots · values as supplied
        </span>
      </div>

      <div>
        {series.map((s) => {
          // Build chart rows purely from supplied values — no derived maths.
          const data = dates.map((date, i) => ({
            date: fmtDate(date),
            value: s.values?.[i] ?? null,
          }))
          const first = s.values?.[0]
          const last = s.values?.[s.values.length - 1]

          return (
            <div className="snap-metric" key={s.label}>
              <div className="snap-head">
                <div>
                  <div className="snap-label">{s.label}</div>
                  <div className="snap-endpoints">
                    <span>{fmtDate(dates[0])}: <strong>{withUnit(first, s.unit)}</strong></span>
                    <span className="snap-arrow">→</span>
                    <span>{fmtDate(dates[dates.length - 1])}: <strong>{withUnit(last, s.unit)}</strong></span>
                  </div>
                </div>
                <div className="snap-latest">{withUnit(last, s.unit)}</div>
              </div>

              <div className="snap-chart">
                <ResponsiveContainer width="100%" height={110}>
                  <LineChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10.5, fill: '#6b7a83' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Tooltip
                      formatter={(v) => [withUnit(v, s.unit), s.label]}
                      contentStyle={{
                        border: '1px solid #e6e3dc',
                        borderRadius: 10,
                        fontSize: 12.5,
                        boxShadow: '0 4px 12px rgba(22,35,43,0.08)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#0d2a3a"
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: '#0d2a3a' }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
