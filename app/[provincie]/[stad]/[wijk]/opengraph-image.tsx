import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function toDisplay(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default async function OGImage({ params }: { params: Promise<{ provincie: string; stad: string; wijk: string }> }) {
  const { wijk, stad } = await params
  const wijkDisplay = toDisplay(wijk)
  const stadDisplay = toDisplay(stad)

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #020617 0%, #0f172a 60%, #1c1208 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
        }}
      >
        {/* Top: logo + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L15.5 6V13L9 17L2.5 13V6L9 2Z" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M9 6.5L12 8.5V12L9 14L6 12V8.5L9 6.5Z" fill="white"/>
              </svg>
            </div>
            <span style={{ color: 'white', fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', fontFamily: 'sans-serif' }}>
              SaldeerScan<span style={{ color: '#f59e0b' }}>.nl</span>
            </span>
          </div>
          <div style={{
            background: 'rgba(245,158,11,0.15)',
            border: '1px solid rgba(245,158,11,0.35)',
            borderRadius: 100, padding: '8px 20px',
            color: '#fbbf24', fontSize: 16, fontWeight: 600, fontFamily: 'sans-serif',
          }}>
            Saldering stopt 1 jan 2027
          </div>
        </div>

        {/* Middle: wijk naam */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: '#f59e0b', fontSize: 16, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>
            Wijk energie-analyse 2027
          </div>
          <div style={{ color: '#f59e0b', fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: '-2px', fontFamily: 'sans-serif' }}>
            {wijkDisplay}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 32, fontWeight: 500, fontFamily: 'sans-serif' }}>
            {stadDisplay}
          </div>
        </div>

        {/* Bottom: CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{
            background: '#f59e0b', color: '#0c0a00',
            borderRadius: 12, padding: '16px 32px',
            fontSize: 20, fontWeight: 700, fontFamily: 'sans-serif',
          }}>
            Gratis saldeercheck starten
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 16, fontFamily: 'sans-serif' }}>
            saldeerscan.nl
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
