type Props = { size?: 'sm' | 'lg' }

// Lockup oficial da marca da plataforma (2F_System): tile hexagonal escuro +
// wordmark + tagline + as 3 barrinhas de cor. Usado no rodapé da sidebar e
// na tela de login — não confundir com o logo/nome do CLIENTE (organization),
// que aparece no topo da sidebar via white-label.
export default function Logo2FSystem({ size = 'lg' }: Props) {
  const sm = size === 'sm'
  const tile = sm ? 32 : 72
  const icon = sm ? 20 : 44
  const radius = sm ? 8 : 16

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: sm ? '.625rem' : '1.25rem' }}>
      <div style={{
        width: tile, height: tile, borderRadius: radius,
        background: '#12161c', border: '1px solid #232b34',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width={icon} height={icon} viewBox="0 0 220 220">
          <polygon points="110,8 205,58 205,162 110,212 15,162 15,58" fill="none" stroke="#4fd1ff" strokeWidth={9} />
          <text x="110" y="132" textAnchor="middle" fontFamily="'Space Grotesk','Segoe UI',system-ui,sans-serif" fontWeight={700} fontSize={92} fill="#f4f6f8" letterSpacing="-2">2F</text>
          <line x1="68" y1="150" x2="152" y2="150" stroke="#4fd1ff" strokeWidth={9} />
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: sm ? '.15rem' : '.375rem' }}>
        <div style={{
          fontFamily: "'Space Grotesk','Segoe UI',system-ui,sans-serif",
          fontSize: sm ? '.8125rem' : '1.625rem', fontWeight: 700, color: '#f4f6f8',
          letterSpacing: sm ? 0 : '.5px', lineHeight: 1,
        }}>
          2F<span style={{ color: '#4fd1ff' }}>_</span>SYSTEM
        </div>
        {!sm && (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '.6875rem', letterSpacing: '2px', color: '#6f7d8c', textTransform: 'uppercase' }}>
            Performance-driven systems
          </div>
        )}
        <div style={{ display: 'flex', gap: sm ? '.25rem' : '.5rem', marginTop: sm ? '.1rem' : '.25rem' }}>
          <div style={{ width: sm ? 10 : 18, height: sm ? 2 : 4, background: '#4fd1ff', borderRadius: 2 }} />
          <div style={{ width: sm ? 10 : 18, height: sm ? 2 : 4, background: '#2fd6a3', borderRadius: 2 }} />
          <div style={{ width: sm ? 10 : 18, height: sm ? 2 : 4, background: '#232b34', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  )
}
