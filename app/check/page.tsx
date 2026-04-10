'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FunnelContainer } from '@/components/funnel/FunnelContainer'

function Header() {
  return (
    <nav className="bg-[#020617]/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#00aa65' }}>
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L15.5 6V13L9 17L2.5 13V6L9 2Z" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M9 6.5L12 8.5V12L9 14L6 12V8.5L9 6.5Z" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-white text-sm tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            SaldeerScan<span style={{ color: '#00aa65' }}>.nl</span>
          </span>
        </a>
        <span className="text-xs font-mono text-white/50">Gratis 2027 saldeercheck</span>
      </div>
    </nav>
  )
}

function CheckPageInner() {
  const searchParams = useSearchParams()
  const initialAdres = searchParams.get('adres') ?? ''
  const initialWijk = searchParams.get('wijk') ?? ''
  const initialStad = searchParams.get('stad') ?? ''

  return (
    <main className="min-h-screen" style={{ background: '#020617' }}>
      <Header />
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            Uw gratis 2027 Saldeercheck
          </h1>
          <p className="text-white/50 text-sm mt-1.5">6 stappen naar uw persoonlijk investeringsrapport</p>
        </div>
        <FunnelContainer initialAdres={initialAdres} initialWijk={initialWijk} initialStad={initialStad} />
      </div>
    </main>
  )
}

const FallbackPage = (
  <main className="min-h-screen" style={{ background: '#020617' }}>
    <div className="max-w-xl mx-auto px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
          Uw gratis 2027 Saldeercheck
        </h1>
      </div>
    </div>
  </main>
)

export default function CheckPage() {
  return (
    <Suspense fallback={FallbackPage}>
      <CheckPageInner />
    </Suspense>
  )
}
