// Shared formatting helpers.

// Base currency for the (Singapore) desk. Change this one constant to
// re-denominate the whole app.
export const CURRENCY = 'S$'

// Generic money formatter. `compact` abbreviates large figures (bn/m/k).
// Negatives keep the sign in front of the currency symbol, e.g. -S$146,000.
export const formatMoney = (value, { compact = true, currency = CURRENCY } = {}) => {
  if (value == null) return '—'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (compact) {
    if (abs >= 1_000_000_000) return `${sign}${currency}${(abs / 1_000_000_000).toFixed(2)}bn`
    if (abs >= 1_000_000) return `${sign}${currency}${(abs / 1_000_000).toFixed(1)}m`
    if (abs >= 1_000) return `${sign}${currency}${(abs / 1_000).toFixed(0)}k`
  }
  return `${sign}${currency}${new Intl.NumberFormat('en-SG').format(abs)}`
}

// Backwards-compatible alias. The app was originally CHF-denominated; call
// sites still use formatChf but now render the desk currency.
export const formatChf = (value, opts) => formatMoney(value, opts)

export const formatPct = (value, { sign = false } = {}) => {
  if (value == null) return '—'
  const s = sign && value > 0 ? '+' : ''
  return `${s}${value.toFixed(1)}%`
}

export const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const formatDateTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const daysSince = (iso) => {
  if (!iso) return null
  const then = new Date(iso).getTime()
  const now = Date.now()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

export const initialsOf = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
