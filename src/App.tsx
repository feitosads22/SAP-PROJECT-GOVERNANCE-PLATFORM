import { AuthProvider, useAuth } from './contexts/AuthContext'
import { configuracaoOk } from './lib/supabase'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Projects from './pages/Projects'

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
          Na Vercel: Settings → Environment Variables, marcando Production,
          Preview e Development. Variável nova só vale no próximo deploy —
          é preciso refazer o Redeploy depois de cadastrar.
        </p>
      </div>
    </div>
  )
}

function Rotas() {
  const { session, profile, loading } = useAuth()

  if (loading) return <div className="tela-centro"><p className="sutil">Carregando…</p></div>
  if (!session) return <Login />
  // Sem organização: só o onboarding. A porta real é a RLS, esta é a navegação.
  if (!profile || profile.organization_id === null) return <Onboarding />
  return <Projects />
}

export default function App() {
  if (!configuracaoOk) return <ErroConfiguracao />
  return (
    <AuthProvider>
      <Rotas />
    </AuthProvider>
  )
}
