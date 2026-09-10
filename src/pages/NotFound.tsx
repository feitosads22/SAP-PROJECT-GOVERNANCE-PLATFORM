import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🔍</div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--brand)', marginBottom: '.5rem' }}>404</h1>
        <p style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)', marginBottom: '.5rem' }}>Página não encontrada</p>
        <p style={{ color: 'var(--subtle)', marginBottom: '2rem' }}>A página que você procura não existe ou foi movida.</p>
        <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/dashboard')}>🏠 Dashboard</button>
          <button className="btn-secondary" onClick={() => navigate(-1)}>← Voltar</button>
        </div>
      </div>
    </div>
  )
}
