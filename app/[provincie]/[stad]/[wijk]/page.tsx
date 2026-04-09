import { cache } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getWijkPage, getTopWijken } from '@/lib/pseo'
import { LocalSchema } from '@/components/pseo/LocalSchema'

// Deduplicate Supabase fetches: generateMetadata + page component share one request
const getCachedWijkPage = cache(getWijkPage)

// ISR: revalidate every 30 days
export const revalidate = 2592000

type Params = { provincie: string; stad: string; wijk: string }

export async function generateStaticParams() {
  try {
    const wijken = await getTopWijken(500)
    return wijken.map(w => ({
      provincie: w.provincie,
      stad: w.stad,
      wijk: w.wijk,
    }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { provincie, stad, wijk } = await params
  const page = await getCachedWijkPage({ provincie, stad, wijk })

  const title = page?.titel ?? `SaldeerScan ${wijk} ${stad} — 2027 check`
  const description = page?.metaDescription ?? `Gratis 2027 saldeercheck voor woningen in ${wijk}, ${stad}. AI-scan, ROI en investeringsrapport.`

  return {
    title,
    description,
    alternates: { canonical: `/${provincie}/${stad}/${wijk}` },
    openGraph: { title, description, type: 'website' },
  }
}

export default async function WijkPage({ params }: { params: Promise<Params> }) {
  const { provincie, stad, wijk } = await params
  const page = await getCachedWijkPage({ provincie, stad, wijk })

  if (!page) notFound()

  const wijkDisplay = wijk.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const stadDisplay = stad.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  const netBadge = {
    ROOD: { label: 'Vol stroomnet', cls: 'bg-red-950/50 border-red-700 text-red-400' },
    ORANJE: { label: 'Druk stroomnet', cls: 'bg-amber-950/50 border-amber-700 text-amber-400' },
    GROEN: { label: 'Vrij stroomnet', cls: 'bg-emerald-950/50 border-emerald-700 text-emerald-400' },
  }
  const net = page.netcongestieStatus ? netBadge[page.netcongestieStatus as keyof typeof netBadge] : null

  return (
    <div className="min-h-screen" style={{ background: '#020617' }}>
      {page.jsonLd && Object.keys(page.jsonLd).length > 0 && (
        <LocalSchema jsonLd={page.jsonLd} />
      )}

      {/* Nav */}
      <nav className="border-b border-white/5 px-6 h-14 flex items-center" style={{ background: 'rgba(2,6,23,0.9)' }}>
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#00aa65' }}>
            <svg width="12" height="12" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L15.5 6V13L9 17L2.5 13V6L9 2Z" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
              <path d="M9 6.5L12 8.5V12L9 14L6 12V8.5L9 6.5Z" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-white text-sm" style={{ fontFamily: 'var(--font-heading)' }}>
            SaldeerScan<span style={{ color: '#00aa65' }}>.nl</span>
          </span>
        </a>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-16 pb-12 text-center" style={{ background: '#020617' }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true"
          style={{ opacity: 0.03, maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)' }}>
          <defs>
            <pattern id="wijk-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgb(100,116,139)" strokeOpacity="0.3" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wijk-grid)" />
        </svg>

        <div className="relative max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {net && (
              <span className={`text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-full border ${net.cls}`}>
                {net.label}
              </span>
            )}
            {page.gemBouwjaar && (
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full border border-white/10 text-white/50">
                Gem. bouwjaar {page.gemBouwjaar}
              </span>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4"
            style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            {wijkDisplay},{' '}
            <span style={{ color: '#f59e0b' }}>{stadDisplay}</span>
          </h1>
          <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Wat betekent 1 januari 2027 voor woningeigenaren in {wijkDisplay}?
          </p>

          <a href={`/check?wijk=${encodeURIComponent(wijk)}&stad=${encodeURIComponent(stad)}`}
            className="inline-flex items-center gap-2 text-base font-bold px-8 py-4 rounded-full transition-all duration-300 bg-amber-500 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:opacity-90 active:scale-105"
            style={{ fontFamily: 'var(--font-heading)' }}>
            Start mijn gratis Saldeercheck
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        {page.hoofdtekst && (
          <div className="space-y-5 mb-14">
            {page.hoofdtekst.split('\n\n').map((para, i) => (
              <p key={i} className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                {para}
              </p>
            ))}
          </div>
        )}

        {page.faqItems.length > 0 && (
          <div>
            <h2 className="text-2xl font-extrabold text-white mb-6" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              Veelgestelde vragen
            </h2>
            <div className="space-y-4">
              {page.faqItems.map((faq, i) => (
                <div key={i} className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-6">
                  <h3 className="font-bold text-white mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{faq.vraag}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{faq.antwoord}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 text-center bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-10">
          <h2 className="text-2xl font-extrabold text-white mb-3" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            Uw persoonlijk investeringsrapport
          </h2>
          <p className="mb-6 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Gratis AI-scan voor uw specifieke woning in {wijkDisplay}. BAG-data, ROI-berekening en ISDE subsidie check.
          </p>
          <a href={`/check?wijk=${encodeURIComponent(wijk)}&stad=${encodeURIComponent(stad)}`}
            className="inline-flex items-center gap-2 text-sm font-bold px-8 py-4 rounded-full transition-all duration-300 bg-amber-500 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:opacity-90 active:scale-105"
            style={{ fontFamily: 'var(--font-heading)' }}>
            Start gratis Saldeercheck
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8 text-center" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#020617' }}>
        <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>© 2026 SaldeerScan.nl</p>
      </footer>
    </div>
  )
}
