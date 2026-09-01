// Shared formatting helpers.

export const formatChf = (value, { compact = true } = {}) => {
  if (value == null) return '—'
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000)
      return `CHF ${(value / 1_000_000_000).toFixed(2)}bn`
    if (Math.abs(value) >= 1_000_000)
      return `CHF ${(value / 1_000_000).toFixed(1)}m`
    if (Math.abs(value) >= 1_000) return `CHF ${(value / 1_000).toFixed(0)}k`
  }
  return `CHF ${new Intl.NumberFormat('en-CH').format(value)}`
}

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
