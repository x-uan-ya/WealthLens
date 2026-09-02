import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader, Card, PriorityBadge, Confidence, Loading } from '../components/ui.jsx'
import { getSignalById } from '../services/dataService.js'
import { formatDate } from '../utils/format.js'

export default function IntelligenceDetail() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let active = true
    setState({ loading: true })
    getSignalById(id).then((signal) => {
      if (active) setState({ loading: false, signal })
    })
    return () => {
      active = false
    }
  }, [id])

  if (state.loading) return <Loading label="Loading signal" />

  const { signal } = state

  if (!signal) {
    return (
      <div>
        <Link className="link-gold" to="/intelligence" style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={15} /> All signals
        </Link>
        <PageHeader title="Signal not found" subtitle="This signal does not exist or may have been removed." />
      </div>
    )
  }

  return (
    <div>
      <Link className="link-gold" to="/intelligence" style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={15} /> All signals
      </Link>

      <PageHeader
        eyebrow={`${signal.category} · ${signal.horizon}`}
        title={signal.headline}
      />

      <Card className="card-pad" style={{ maxWidth: 640 }}>
        <div className="row wrap" style={{ gap: 12, marginBottom: 20 }}>
          <PriorityBadge priority={signal.priority} />
          <Confidence value={signal.confidence} />
        </div>

        <div className="kv">
          <span className="k">Client</span>
          <span className="v">
            <Link className="link-gold" to={`/clients/${signal.clientId}`}>
              {signal.clientName}
            </Link>
          </span>
        </div>
        <div className="kv">
          <span className="k">Detected</span>
          <span className="v">{formatDate(signal.createdAt)}</span>
        </div>
        <div className="kv">
          <span className="k">Horizon</span>
          <span className="v">{signal.horizon}</span>
        </div>
        <div className="kv">
          <span className="k">Category</span>
          <span className="v">{signal.category}</span>
        </div>
      </Card>
    </div>
  )
}
