import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { configuracaoOk } from './lib/supabase'
import AppSidebar from './components/AppSidebar'
import AppTopbar  from './components/AppTopbar'
import Login             from './pages/Login'
import Onboarding        from './pages/Onboarding'
import Dashboard         from './pages/Dashboard'
import Projects          from './pages/Projects'
import ProjectDetail     from './pages/ProjectDetail'
import MyTasks           from './pages/MyTasks'
import Capacity          from './pages/Capacity'
import TimesheetPage     from './pages/TimesheetPage'
import BudgetPage        from './pages/BudgetPage'
import GovernancePage    from './pages/GovernancePage'
import PortfolioPage     from './pages/PortfolioPage'
import CustomerPortalPage  from './pages/CustomerPortalPage'
import CustomerManagePage  from './pages/CustomerManagePage'
import KnowledgePage     from './pages/KnowledgePage'
import DemandsPage       from './pages/DemandsPage'
import TeamManagePage    from './pages/TeamManagePage'
import ConsultantDashboard from './pages/ConsultantDashboard'
import SchedulePage      from './pages/SchedulePage'
import ResourcesPage     from './pages/ResourcesPage'
import ProfilePage       from './pages/ProfilePage'
import SettingsPage      from './pages/SettingsPage'
import DocumentsPage     from './pages/DocumentsPage'
import ReportsPage       from './pages/ReportsPage'

function ErroConfiguracao() {
  return (
    <div className="tela-centro">
      <div className="cartao">
        <h1>Configuração ausente</h1>
        <p className="sutil">Configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.</p>
      </div>
    </div>
  )
}

function AppLayout() {
  const { session, profile, loading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) return (
    <div className="tela-centro"><p className="sutil">Carregando…</p></div>
  )
  if (!session)  return <Login />
  if (!profile || profile.organization_id === null) return <Onboarding />

  const role   = profile.role
  const userId = profile.id

  return (
    <div className="app-layout">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <AppTopbar onMenuToggle={() => setSidebarOpen(o => !o)} />
        <Routes>
          <Route path="/dashboard"              element={role === 'consultant' ? <ConsultantDashboard /> : <Dashboard />} />
          <Route path="/"                       element={<Projects />} />
          <Route path="/projeto/:id"            element={<ProjectDetail role={role} userId={userId} />} />
          <Route path="/minhas"                 element={<MyTasks role={role} userId={userId} />} />
          <Route path="/capacidade"             element={<Capacity />} />
          <Route path="/timesheet"              element={<TimesheetPage role={role} userId={userId} />} />
          <Route path="/projeto/:id/financeiro" element={<BudgetPage role={role} userId={userId} />} />
          <Route path="/projeto/:id/governanca" element={<GovernancePage role={role} userId={userId} />} />
          <Route path="/portfolio"              element={<PortfolioPage role={role} />} />
          <Route path="/portal-cliente"         element={<CustomerPortalPage />} />
          <Route path="/projeto/:id/clientes"   element={<CustomerManagePage role={role} userId={userId} />} />
          <Route path="/knowledge"              element={<KnowledgePage role={role} userId={userId} />} />
          <Route path="/demandas"               element={<DemandsPage />} />
          <Route path="/documentos"             element={<DocumentsPage />} />
          <Route path="/relatorios"             element={<ReportsPage />} />
          <Route path="/equipe"                   element={<TeamManagePage role={role} />} />
          <Route path="/recursos"                 element={<ResourcesPage role={role} />} />
          <Route path="/cronograma/:id"           element={<SchedulePage role={role} />} />
          <Route path="/perfil"                   element={<ProfilePage />} />
          <Route path="/configuracoes"            element={<SettingsPage role={role} />} />
          <Route path="*"                       element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  )
}

export default function Root() {
  if (!configuracaoOk) return <ErroConfiguracao />
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  )
}
