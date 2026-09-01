import { useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'
import { getRelationshipManager } from './services/dataService.js'

import Overview from './pages/Overview.jsx'
import Clients from './pages/Clients.jsx'
import ClientDetail from './pages/ClientDetail.jsx'
import Intelligence from './pages/Intelligence.jsx'
import IntelligenceDetail from './pages/IntelligenceDetail.jsx'
import Portfolios from './pages/Portfolios.jsx'
import ScenarioLab from './pages/ScenarioLab.jsx'
import Briefings from './pages/Briefings.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  const [rm, setRm] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    getRelationshipManager().then(setRm)
  }, [])

  // Close the mobile drawer on route change.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="app">
      <Sidebar rm={rm} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div
        className={`scrim${menuOpen ? ' show' : ''}`}
        onClick={() => setMenuOpen(false)}
      />
      <div className="main">
        <Topbar rm={rm} onMenu={() => setMenuOpen(true)} />
        <main className="content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/intelligence" element={<Intelligence />} />
            <Route path="/intelligence/:id" element={<IntelligenceDetail />} />
            <Route path="/portfolios" element={<Portfolios />} />
            <Route path="/scenario-lab" element={<ScenarioLab />} />
            <Route path="/briefings" element={<Briefings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
