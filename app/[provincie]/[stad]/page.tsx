import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getWijkenByStad, getTopStadden } from '@/lib/pseo'

export const revalidate = 604800

type Params = { provincie: string; stad: string }

function toDisplay(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export async function generateStaticParams() {
  try {
    const stads = await getTopStadden(200)
    return stads.map(s => ({ provincie: s.provincie, stad: s.stad }))
  } catch { return [] }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { provincie, stad } = await params
  const stadDisplay = toDisplay(stad)
  const provDisplay = toDisplay(provincie)
  const title = `Zonnepanelen ${stadDisplay} — 2027 Saldeercheck per wijk`
  const description = `Bekijk de 2027 salderingsstatus per wijk in ${stadDisplay}. Gratis AI-scan, ROI-berekening en investeringsrapport voor uw woning.`
  return {
    title,
    description,
    alternates: { canonical: `https://saldeerscan.nl/${provincie}/${stad}` },
    openGraph: { title, description, type: 'website', locale: 'nl_NL', url: `https://saldeerscan.nl/${provincie}/${stad}` },
  }
}

const NET_CONFIG = {
  ROOD:   { label: 'Vol',   dot: '#ef4444', cls: 'bg-red-950/50 border-red-700/60 text-red-400' },
  ORANJE: { label: 'Druk',  dot: '#f59e0b', cls: 'bg-amber-950/50 border-amber-700/60 text-amber-400' },
  GROEN:  { label: 'Vrij',  dot: '#10b981', cls: 'bg-emerald-950/50 border-emerald-700/60 text-emerald-400' },
}

const N1 = '#020617'
const N2 = '#0f172a'
const AMBER = '#f59e0b'
const G = '#00aa65'

const amberBtnCls = [
  'bg-amber-500 text-slate-950 font-bold rounded-full',
  'transition-all duration-300',
  'shadow-[0_0_25px_rgba(245,158,11,0.4)]',
  'hover:opacity-90 active:scale-105',
].join(' ')

export default async function StadPage({ params }: { params: Promise<Params> }) {
  const { provincie, stad } = await params
  const wijken = await getWijkenByStad(provincie, stad)
  if (wijken.length === 0) notFound()

  const stadDisplay = toDisplay(stad)
  const provDisplay = toDisplay(provincie)

  const totalWoningen = wijken.reduce((s, w) => s + (w.aantal_woningen ?? 0), 0)
  const avgScore = Math.round(
    wijken.filter(w => w.gem_health_score).reduce((s, w) => s + (w.gem_health_score ?? 0), 0) /
    (wijken.filter(w => w.gem_health_score).length || 1)
  )
  const roodCount = wijken.filter(w => w.netcongestie_status === 'ROOD').length

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Zonnepanelen ${stadDisplay} — 2027 Saldeercheck`,
    description: `Overzicht van alle wijken in ${stadDisplay} met 2027 saldering impact, netcongestie en energiescore.`,
    url: `https://saldeerscan.nl/${provincie}/${stad}`,
    about: {
      '@type': 'City',
      name: stadDisplay,
      addressRegion: provDisplay,
      addressCountry: 'NL',
    },
    hasPart: wijken.slice(0, 10).map(w => ({
      '@type': 'WebPage',
      name: `${toDisplay(w.wijk)} ${stadDisplay} — 2027 Saldeercheck`,
      url: `https://saldeerscan.nl/${provincie}/${stad}/${w.wijk}`,
    })),
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://saldeerscan.nl' },
      { '@type': 'ListItem', position: 2, name: provDisplay, item: `https://saldeerscan.nl/${provincie}` },
      { '@type': 'ListItem', position: 3, name: stadDisplay, item: `https://saldeerscan.nl/${provincie}/${stad}` },
    ],
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: N1 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: G }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L15.5 6V13L9 17L2.5 13V6L9 2Z" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M9 6.5L12 8.5V12L9 14L6 12V8.5L9 6.5Z" fill="white"/>
              </svg>
            </div>
            <span className="font-bold text-[#0e352e] tracking-tight text-lg" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              SaldeerScan<span style={{ color: G }}>.nl</span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            <a href={`/${provincie}`} className="hidden sm:block text-sm text-slate-500 hover:text-slate-800 transition-colors">
              {provDisplay}
            </a>
            <a href="/check" className="text-sm font-bold px-5 py-2.5 rounded-full bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:brightness-110 transition-all">
              Gratis analyseren
            </a>
          </div>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <p className="text-xs font-mono text-white/30">
          <a href="/" className="hover:text-white/60 transition-colors">Home</a>
          {' · '}
          <a href={`/${provincie}`} className="hover:text-white/60 transition-colors">{provDisplay}</a>
          {' · '}
          <span className="text-white/50">{stadDisplay}</span>
        </p>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-10 pb-12" style={{ background: N1 }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(245,158,11,0.06)' }} />

        <div className="relative max-w-5xl mx-auto text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: AMBER }}>
            // STAD ENERGIE DASHBOARD
          </p>
          <h1 className="font-black text-white mb-2 leading-none"
            style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.2rem, 6vw, 3.8rem)', letterSpacing: '-0.03em' }}>
            Zonnepanelen {stadDisplay}
          </h1>
          <p className="text-base mb-8 font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {wijken.length} wijken · {provDisplay} · 2027 saldering impact
          </p>

          {/* Stad stats ribbon */}
          <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto mb-2">
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-1">Wijken</p>
              <p className="text-2xl font-black font-mono" style={{ color: AMBER }}>{wijken.length}</p>
              <p className="text-[9px] font-mono text-white/25 mt-1">geanalyseerd</p>
            </div>
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-1">Woningen</p>
              <p className="text-2xl font-black font-mono" style={{ color: AMBER }}>
                {totalWoningen > 0 ? `${Math.round(totalWoningen / 1000)}k+` : '—'}
              </p>
              <p className="text-[9px] font-mono text-white/25 mt-1">CBS 2023</p>
            </div>
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-1">Netdruk</p>
              <p className="text-2xl font-black font-mono text-red-400">{roodCount}</p>
              <p className="text-[9px] font-mono text-white/25 mt-1">wijken vol net</p>
            </div>
          </div>
        </div>
      </section>

      {/* Urgentie strip */}
      <div className="bg-red-950/40 border-y border-red-700/40 px-6 py-3">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-mono text-red-300">
            ⚠ Per 1 januari 2027 stopt de salderingsregeling — woningbezitters in {stadDisplay} verliezen gemiddeld €{avgScore > 60 ? '650' : '450'}–€{avgScore > 60 ? '950' : '700'} per jaar aan saldeervoordeel
          </p>
        </div>
      </div>

      {/* Wijk grid */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-1">[WIJKEN]</p>
            <h2 className="text-xl font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              Alle wijken in {stadDisplay}
            </h2>
          </div>
          <a href="/check" className="hidden sm:inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-full bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:brightness-110 transition-all">
            Mijn adres scannen →
          </a>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {wijken.map((w) => {
            const net = w.netcongestie_status ? NET_CONFIG[w.netcongestie_status as keyof typeof NET_CONFIG] : null
            const score = w.gem_health_score ?? 52
            const scoreColor = score >= 75 ? '#10b981' : score >= 60 ? AMBER : score >= 45 ? '#f97316' : '#ef4444'

            return (
              <a
                key={w.wijk}
                href={`/${provincie}/${stad}/${w.wijk}`}
                className="group bg-slate-900/40 border border-white/10 rounded-2xl p-5 hover:border-amber-500/30 hover:bg-slate-900/60 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors" style={{ fontFamily: 'var(--font-heading)' }}>
                    {toDisplay(w.wijk)}
                  </h3>
                  {net && (
                    <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${net.cls} shrink-0 ml-2`}>
                      {w.netcongestie_status}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>
                    <p className="text-white/30 text-[9px] uppercase tracking-wider">Score</p>
                    <p className="font-bold" style={{ color: scoreColor }}>{score}/100</p>
                  </div>
                  {w.gem_bouwjaar && (
                    <div>
                      <p className="text-white/30 text-[9px] uppercase tracking-wider">Bouwjaar</p>
                      <p className="text-white/70">{w.gem_bouwjaar}</p>
                    </div>
                  )}
                  {w.aantal_woningen && (
                    <div>
                      <p className="text-white/30 text-[9px] uppercase tracking-wider">Woningen</p>
                      <p className="text-white/70">{w.aantal_woningen.toLocaleString('nl-NL')}</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-amber-500/60 group-hover:text-amber-400 transition-colors">
                  <span>Bekijk wijk →</span>
                </div>
              </a>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-10">
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-8 text-center"
          style={{ boxShadow: '0 0 40px rgba(245,158,11,0.04)' }}>
          <p className="text-[9px] font-mono uppercase tracking-widest mb-3" style={{ color: AMBER }}>[CONVERSIE]</p>
          <h2 className="text-xl font-extrabold text-white mb-2" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            Uw woning in {stadDisplay} analyseren?
          </h2>
          <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Gratis AI-scan op basis van BAG-data. ROI-berekening en 2027 impact in 3 minuten.
          </p>
          <a href="/check" className="inline-flex items-center gap-2 font-bold px-8 py-4 rounded-full bg-amber-500 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.45)] hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] transition-all text-sm"
            style={{ fontFamily: 'var(--font-heading)' }}>
            Start gratis Saldeercheck
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </section>

      <footer className="py-12 px-6" style={{ background: N1, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: G }}>
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2L15.5 6V13L9 17L2.5 13V6L9 2Z" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M9 6.5L12 8.5V12L9 14L6 12V8.5L9 6.5Z" fill="white" />
                  </svg>
                </div>
                <span className="font-bold text-white text-base" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
                  SaldeerScan.nl
                </span>
              </div>
              <p className="text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Gratis energieanalyse voor Nederlandse woningeigenaren.
              </p>
            </div>
            <a href="/check" className={`text-sm px-6 py-3 ${amberBtnCls}`}>
              Gratis analyseren
            </a>
          </div>
          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div className="flex gap-6 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
              <a href="/privacy" className="hover:text-white/50 transition-colors">Privacyverklaring</a>
              <a href="/check" className="hover:text-white/50 transition-colors">Analyseer uw woning</a>
            </div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>© 2026 SaldeerScan.nl</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
