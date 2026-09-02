import { Search, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import Notifications from './Notifications.jsx'

export default function Topbar({ rm, onMenu }) {
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu">
        <Menu size={20} />
      </button>

      <div className="search">
        <Search size={17} strokeWidth={2} />
        <input placeholder="Search clients, signals, briefings…" aria-label="Search" />
        <kbd>/</kbd>
      </div>

      <div className="topbar-actions">
        <Notifications />

        <Link to="/settings" className="rm-chip" aria-label="Relationship Manager profile and settings">
          <div className="avatar">{rm?.initials}</div>
          <div className="rm-meta">
            <div className="rm-name">{rm?.name}</div>
            <div className="rm-role">{rm?.title}</div>
          </div>
        </Link>
      </div>
    </header>
  )
}
