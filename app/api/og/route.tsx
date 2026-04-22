import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const titel = searchParams.get('titel') ?? 'SaldeerScan.nl'
  const score = searchParams.get('score')
  const status = searchParams.get('status')
  const type = searchParams.get('type') ?? 'wijk'

  const statusColor =
    status === 'ROOD' ? '#f87171' :
    status === 'ORANJE' ? '#fb923c' :
    status === 'GROEN' ? '#34d399' : null
  const statusLabel =
    status === 'ROOD' ? 'Vol stroomnet' :
    status === 'ORANJE' ? 'Druk stroomnet' :
    status === 'GROEN' ? 'Vrij stroomnet' : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 60%, #1e293b 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: '16px', height: '16px', background: '#020617', borderRadius: '2px' }} />
          </div>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '20px' }}>SaldeerScan.nl</span>
          {statusColor && statusLabel && (
            <div style={{
              marginLeft: 'auto',
              padding: '6px 16px',
              borderRadius: '999px',
              border: `1px solid ${statusColor}40`,
              background: `${statusColor}15`,
              color: statusColor,
              fontSize: '16px',
            }}>
              {statusLabel}
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            color: '#f59e0b',
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '3px',
          }}>
            {type === 'straat' ? 'Straat analyse' : 'Wijk analyse'} · 2027 Saldering
          </div>
          <div style={{
            color: '#f8fafc',
            fontSize: titel.length > 50 ? '36px' : '44px',
            fontWeight: 'bold',
            lineHeight: '1.2',
            maxWidth: score ? '780px' : '100%',
          }}>
            {titel}
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '18px' }}>
            Gratis zonnepanelen analyse · saldeerscan.nl
          </div>
          {score && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '12px 24px',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: '16px',
              background: 'rgba(245,158,11,0.08)',
            }}>
              <span style={{ color: '#f59e0b', fontSize: '42px', fontWeight: 'bold' }}>{score}</span>
              <span style={{ color: 'rgba(245,158,11,0.6)', fontSize: '13px' }}>/ 100</span>
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
