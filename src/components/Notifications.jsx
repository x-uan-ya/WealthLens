import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Radar, CalendarClock, UserRound, Settings, CheckCheck } from 'lucide-react'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/dataService.js'
import { timeAgo } from '../utils/format.js'

const TYPE_ICON = {
  intelligence: Radar,
  meeting: CalendarClock,
  client: UserRound,
  system: Settings,
}

export default function Notifications() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    getNotifications().then(setItems)
  }, [])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = items.filter((n) => !n.read).length

  const openItem = (n) => {
    markNotificationRead(n.id).then(setItems)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const markAll = () => markAllNotificationsRead().then(setItems)

  return (
    <div className="notif" ref={ref}>
      <button
        className="icon-btn"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={19} strokeWidth={1.9} />
        {unread > 0 && <span className="notif-count">{unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="menu">
          <div className="notif-head">
            <span style={{ fontWeight: 600 }}>Notifications</span>
            {unread > 0 && (
              <button className="link-gold" style={{ fontSize: 12.5 }} onClick={markAll}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {items.length === 0 ? (
              <div className="empty" style={{ padding: 28 }}>You&rsquo;re all caught up.</div>
            ) : (
              items.map((n) => {
                const Icon = TYPE_ICON[n.type] || Bell
                return (
                  <button
                    key={n.id}
                    className={`notif-item${n.read ? '' : ' unread'}`}
                    onClick={() => openItem(n)}
                  >
                    <span className="notif-icon">
                      <Icon size={15} />
                    </span>
                    <span className="notif-body">
                      <span className="notif-title">{n.title}</span>
                      <span className="notif-text">{n.body}</span>
                      <span className="notif-time">{timeAgo(n.time)}</span>
                    </span>
                    {!n.read && <span className="notif-dot" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
