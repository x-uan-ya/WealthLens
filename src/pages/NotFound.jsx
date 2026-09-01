import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <div>
      <PageHeader title="Page not found" subtitle="This view does not exist yet." />
      <Link className="link-gold" to="/">
        Return to Overview
      </Link>
    </div>
  )
}
