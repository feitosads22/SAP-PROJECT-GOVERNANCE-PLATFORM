import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { configuracaoOk } from './lib/supabase'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import MyTasks from './pages/MyTasks'
import Capacity from './pages/Capacity'
import TimesheetPage from './pages/TimesheetPage'
import BudgetPage from './pages/BudgetPage'
import GovernancePage from './pages/GovernancePage'
import NavBar from './components/NavBar'

function ErroConfiguracao() {
  return (
    <div className="tela-centro">
      <div className="cartao">
        <h1>Configuração ausente</h1>
        <p className="sutil">
          As variáveis <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> não chegaram ao build.
        </p>
        <p className="sutil">
          Vercel → Settings → Environment Variables → cadastre as duas →
          Deployments → Redeploy.
        </p>
      </div>
    </div>
  )
}

function App() {
  const { session, profile, loading } = useAuth()

  if (loading) return <div className="tela-centro"><p className="sutil">Carregando…</p></div>
  if (!session) return <Login />
  if (!profile || profile.organization_id === null) return <Onboarding />

  const role    = profile.role
  const userId  = profile.id

  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/"              element={<Projects />} />
        <Route path="/projeto/:id"   element={<ProjectDetail role={role} userId={userId} />} />
        <Route path="/minhas"        element={<MyTasks role={role} userId={userId} />} />
        <Route path="/capacidade"     element={<Capacity />} />
        <Route path="/projeto/:id/financeiro"   element={<BudgetPage role={role} userId={userId} />} />
        <Route path="/projeto/:id/governanca"  element={<GovernancePage role={role} userId={userId} />} />
        <Route path="/timesheet"      element={<TimesheetPage role={role} userId={userId} />} />
        <Route path="/projeto/:id/financeiro"   element={<BudgetPage role={role} userId={userId} />} />
        <Route path="/projeto/:id/governanca"  element={<GovernancePage role={role} userId={userId} />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function Root() {
  if (!configuracaoOk) return <ErroConfiguracao />
  return (
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  )
}
