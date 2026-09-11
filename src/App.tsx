import { Suspense, lazy, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { configuracaoOk } from './lib/supabase'
import AppSidebar from './components/AppSidebar'
import AppTopbar  from './components/AppTopbar'
import Login             from './pages/Login'
import Onboarding        from './pages/Onboarding'
import ToastContainer from './components/Toast'

// Code splitting: cada página vira um chunk próprio, carregado sob demanda.
const Dashboard           = lazy(() => import('./pages/Dashboard'))
const Projects            = lazy(() => import('./pages/Projects'))
const ProjectDetail       = lazy(() => import('./pages/ProjectDetail'))
const MyTasks             = lazy(() => import('./pages/MyTasks'))
const Capacity            = lazy(() => import('./pages/Capacity'))
const TimesheetPage       = lazy(() => import('./pages/TimesheetPage'))
const BudgetPage          = lazy(() => import('./pages/BudgetPage'))
const GovernancePage      = lazy(() => import('./pages/GovernancePage'))
const PortfolioPage       = lazy(() => import('./pages/PortfolioPage'))
const CustomerPortalPage  = lazy(() => import('./pages/CustomerPortalPage'))
const CustomerManagePage  = lazy(() => import('./pages/CustomerManagePage'))
const KnowledgePage       = lazy(() => import('./pages/KnowledgePage'))
const DemandsPage         = lazy(() => import('./pages/DemandsPage'))
const TeamManagePage      = lazy(() => import('./pages/TeamManagePage'))
const ConsultantDashboard = lazy(() => import('./pages/ConsultantDashboard'))
const SchedulePage        = lazy(() => import('./pages/SchedulePage'))
const ResourcesPage       = lazy(() => import('./pages/ResourcesPage'))
const ProfilePage         = lazy(() => import('./pages/ProfilePage'))
const SettingsPage        = lazy(() => import('./pages/SettingsPage'))
const NotificationsPage   = lazy(() => import('./pages/NotificationsPage'))
const NotFound            = lazy(() => import('./pages/NotFound'))
const DocumentsPage       = lazy(() => import('./pages/DocumentsPage'))
const ReportsPage         = lazy(() => import('./pages/ReportsPage'))

function RouteFallback() {
  return <div className="page"><p className="sutil">Carregando…</p></div>
}

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
        <Suspense fallback={<RouteFallback />}>
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
          <Route path="/notificacoes"             element={<NotificationsPage />} />
          <Route path="*"                       element={<NotFound />} />
        </Routes>
        </Suspense>
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
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  )
}
