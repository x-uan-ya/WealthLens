import { Search, Bell, Menu } from 'lucide-react'

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
        <button className="icon-btn" aria-label="Notifications">
          <Bell size={19} strokeWidth={1.9} />
          <span className="dot" />
        </button>

        <div className="rm-chip">
          <div className="avatar">{rm?.initials}</div>
          <div className="rm-meta">
            <div className="rm-name">{rm?.name}</div>
            <div className="rm-role">{rm?.title}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
