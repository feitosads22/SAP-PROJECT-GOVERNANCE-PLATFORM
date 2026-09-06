import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Projects from './pages/Projects'

function Rotas() {
  const { session, profile, loading } = useAuth()

  if (loading) return <div className="tela-centro"><p className="sutil">Carregando…</p></div>
  if (!session) return <Login />
  // Sem organização: só o onboarding. A porta real é a RLS, esta é a navegação.
  if (!profile || profile.organization_id === null) return <Onboarding />
  return <Projects />
}

export default function App() {
  return (
    <AuthProvider>
      <Rotas />
    </AuthProvider>
  )
}
