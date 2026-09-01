import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Radar,
  PieChart,
  FlaskConical,
  FileText,
} from 'lucide-react'
import { formatChf } from '../utils/format.js'

const primaryNav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/intelligence', label: 'Intelligence', icon: Radar },
  { to: '/portfolios', label: 'Portfolios', icon: PieChart },
]

const workNav = [
  { to: '/scenario-lab', label: 'Scenario Lab', icon: FlaskConical },
  { to: '/briefings', label: 'Briefings', icon: FileText },
]

export default function Sidebar({ rm, open, onNavigate }) {
  const renderItem = ({ to, label, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
      onClick={onNavigate}
    >
      <Icon size={18} strokeWidth={1.9} />
      <span>{label}</span>
    </NavLink>
  )

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">
          <svg width="20" height="20" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="8" fill="none" stroke="#c8a24a" strokeWidth="2" />
            <circle cx="16" cy="16" r="2.6" fill="#c8a24a" />
          </svg>
        </div>
        <div>
          <div className="brand-name">WealthLens</div>
          <div className="brand-sub">Private Intelligence</div>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-label">Manage</div>
        {primaryNav.map(renderItem)}
        <div className="nav-label">Prepare</div>
        {workNav.map(renderItem)}
      </nav>

      <div className="sidebar-foot">
        <div className="nav-label" style={{ padding: '0 0 4px' }}>
          Book under management
        </div>
        <div className="aum">{formatChf(rm?.aumChf)}</div>
        <div style={{ fontSize: 12, color: 'rgba(205,216,221,0.55)', marginTop: 2 }}>
          {rm?.clientsManaged} client relationships
        </div>
      </div>
    </aside>
  )
}
