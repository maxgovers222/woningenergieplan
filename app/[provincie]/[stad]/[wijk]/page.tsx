import { cache } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getWijkPage, getTopWijken, getWijkenByStad } from '@/lib/pseo'
import { LocalSchema } from '@/components/pseo/LocalSchema'
import { WijkSaldeerChart } from '@/components/pseo/WijkSaldeerChart'
import { CountdownTimer } from '@/components/CountdownTimer'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { WijkCtaButton } from '@/components/pseo/WijkCtaButton'

const getCachedWijkPage = cache(getWijkPage)

export const revalidate = 604800

type Params = { provincie: string; stad: string; wijk: string }

export async function generateStaticParams() {
  try {
    const wijken = await getTopWijken(500)
    return wijken.map(w => ({ provincie: w.provincie, stad: w.stad, wijk: w.wijk }))
  } catch { return [] }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { provincie, stad, wijk } = await params
  const page = await getCachedWijkPage({ provincie, stad, wijk })
  const title = page?.titel ?? `SaldeerScan ${wijk} ${stad} — 2027 check`
  const description = page?.metaDescription ?? `Gratis 2027 saldeercheck voor woningen in ${wijk}, ${stad}. AI-scan, ROI en investeringsrapport.`
  return {
    title, description,
    alternates: { canonical: `https://saldeerscan.nl/${provincie}/${stad}/${wijk}` },
    openGraph: { title, description, type: 'website', locale: 'nl_NL', url: `https://saldeerscan.nl/${provincie}/${stad}/${wijk}` },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplay(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function wijkScore(bouwjaar: number | null, healthScore: number | null): number {
  if (healthScore !== null && healthScore > 0) return healthScore
  if (!bouwjaar) return 52
  if (bouwjaar < 1960) return 34
  if (bouwjaar < 1975) return 44
  if (bouwjaar < 1990) return 55
  if (bouwjaar < 2005) return 66
  if (bouwjaar < 2015) return 74
  return 81
}

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Uitstekend', color: '#10b981' }
  if (score >= 60) return { label: 'Goed', color: '#f59e0b' }
  if (score >= 45) return { label: 'Matig', color: '#f97316' }
  return { label: 'Laag', color: '#ef4444' }
}

function renderBold(text: string) {
  const parts = text.split('**')
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="text-white font-semibold">{part}</strong>
      : part
  )
}

function neighborhoodRanking(bouwjaar: number | null, score: number): { top: boolean; label: string } | null {
  if (!bouwjaar) return null
  const rendementScore = bouwjaar >= 1995 && bouwjaar <= 2015 ? 92 : score
  if (rendementScore >= 90) return { top: true, label: 'Top 10% meest rendabele wijken' }
  if (rendementScore >= 74) return { top: true, label: 'Top 25% meest rendabele wijken' }
  return null
}

function computeBesparing(bouwjaar: number | null, score: number): number {
  const base = bouwjaar
    ? bouwjaar < 1970 ? 720
    : bouwjaar < 1990 ? 960
    : bouwjaar < 2010 ? 840
    : 660
    : 780
  return Math.round(base * (score / 65))
}

function splitContent(tekst: string | null): { analyse: string[]; netwerk: string[] } {
  if (!tekst) return { analyse: [], netwerk: [] }
  const paras = tekst.split('\n\n').filter(Boolean)
  const mid = Math.ceil(paras.length / 2)
  return { analyse: paras.slice(0, mid), netwerk: paras.slice(mid) }
}

// ── Palette & shared styles ───────────────────────────────────────────────────

const G     = '#00aa65'
const AMBER = '#f59e0b'
const N1    = '#020617'
const N2    = '#0f172a'

const amberBtnCls = [
  'bg-amber-500 text-slate-950 font-bold rounded-full',
  'transition-all duration-300',
  'shadow-[0_0_25px_rgba(245,158,11,0.4)]',
  'hover:opacity-90 active:scale-105',
].join(' ')

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function WijkPage({ params }: { params: Promise<Params> }) {
  const { provincie, stad, wijk } = await params
  const [page, wijkenInStad] = await Promise.all([
    getCachedWijkPage({ provincie, stad, wijk }),
    getWijkenByStad(provincie, stad),
  ])
  if (!page) notFound()
  const relatedWijken = wijkenInStad.filter(w => w.wijk !== wijk).slice(0, 6)

  const wijkDisplay = toDisplay(wijk)
  const stadDisplay = toDisplay(stad)
  const score = wijkScore(page.gemBouwjaar, page.gemHealthScore)
  const { label: scorelabel, color: scoreColor } = scoreLabel(score)
  const besparing = computeBesparing(page.gemBouwjaar, score)
  // Verlies = terugleveringsvoordeel dat wegvalt na 2027 (~40% van besparing)
  const verlies = Math.round(besparing * 0.40)
  const ranking = neighborhoodRanking(page.gemBouwjaar, score)
  const { analyse, netwerk } = splitContent(page.hoofdtekst)

  const netConfig = {
    ROOD:   { label: 'Vol stroomnet',  dot: '#ef4444', cls: 'bg-red-950/50 border-red-700 text-red-400' },
    ORANJE: { label: 'Druk stroomnet', dot: '#f59e0b', cls: 'bg-amber-950/50 border-amber-700 text-amber-400' },
    GROEN:  { label: 'Vrij stroomnet', dot: '#10b981', cls: 'bg-emerald-950/50 border-emerald-700 text-emerald-400' },
  }
  const net = page.netcongestieStatus ? netConfig[page.netcongestieStatus as keyof typeof netConfig] : null

  return (
    <div className="min-h-screen pb-24 sm:pb-0" style={{ background: N1 }}>
      {page.jsonLd && Object.keys(page.jsonLd).length > 0 && <LocalSchema jsonLd={page.jsonLd} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://saldeerscan.nl' },
          { '@type': 'ListItem', position: 2, name: toDisplay(provincie), item: `https://saldeerscan.nl/${provincie}` },
          { '@type': 'ListItem', position: 3, name: stadDisplay, item: `https://saldeerscan.nl/${provincie}/${stad}` },
          { '@type': 'ListItem', position: 4, name: wijkDisplay, item: `https://saldeerscan.nl/${provincie}/${stad}/${wijk}` },
        ],
      }).replace(/<\/script>/g, '<\\/script>') }} />

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: G }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L15.5 6V13L9 17L2.5 13V6L9 2Z" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M9 6.5L12 8.5V12L9 14L6 12V8.5L9 6.5Z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-[#0e352e] tracking-tight text-lg" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              SaldeerScan<span style={{ color: G }}>.nl</span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-500 font-medium">
              {wijkDisplay}, {stadDisplay}
            </span>
            <WijkCtaButton wijk={wijk} stad={stad} className={`text-sm px-5 py-2.5 ${amberBtnCls}`}>
              Gratis analyseren
            </WijkCtaButton>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ background: N1 }}>
        {/* SVG grid — vervaagt naar beneden */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true"
          style={{ opacity: 0.03, maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}>
          <defs>
            <pattern id="wijk-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgb(100,116,139)" strokeOpacity="0.3" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wijk-grid)" />
        </svg>
        {/* Zachte radiale gloed */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `radial-gradient(ellipse 70% 50% at 50% -5%, rgba(0,170,101,0.14) 0%, transparent 70%)`,
        }} />

        <div className="relative max-w-4xl mx-auto px-6 py-20 sm:py-28 text-center">
          {/* Breadcrumb */}
          <p className="text-xs text-white/30 mb-6">
            <a href="/" className="hover:text-white/60 transition-colors">Home</a>
            {' · '}
            <a href={`/${provincie}`} className="hover:text-white/60 transition-colors">{toDisplay(provincie)}</a>
            {' · '}
            <a href={`/${provincie}/${stad}`} className="hover:text-white/60 transition-colors">{stadDisplay}</a>
            {' · '}
            <span className="text-white/50">{wijkDisplay}</span>
          </p>

          {/* Green badge — zelfde patroon als homepage */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
            style={{ background: G, color: 'white', fontFamily: 'var(--font-heading)' }}>
            <span className="w-1.5 h-1.5 bg-white rounded-full opacity-80" />
            {stadDisplay} · Gratis wijkanalyse 2027
          </div>

          <h1 className="font-extrabold text-white mb-4"
            style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            {wijkDisplay}
          </h1>
          <p className="text-lg text-white/65 mb-4">
            {page.aantalWoningen ? `${page.aantalWoningen.toLocaleString('nl')} woningen` : stadDisplay} · {toDisplay(provincie)}
          </p>

          {ranking ? (
            <div className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(245,158,11,0.15)', color: AMBER, border: '1px solid rgba(245,158,11,0.3)', fontFamily: 'var(--font-heading)' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5l1.6 3.9 4.4.4-3.2 3 .9 4.3L8 10.8l-3.7 2.3.9-4.3L2 5.8l4.4-.4z"/></svg>
              {ranking.label} in {stadDisplay}
            </div>
          ) : (
            <div className="mb-8" />
          )}

          {/* Data Ribbon */}
          <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto mb-10">
            <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: G, fontFamily: 'var(--font-heading)' }}>Grid Status</p>
              {net ? (
                <>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: net.dot }} />
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${net.cls}`} style={{ fontFamily: 'var(--font-heading)' }}>
                      {page.netcongestieStatus}
                    </span>
                  </div>
                  <p className="text-xs text-white/40">{net.label}</p>
                </>
              ) : (
                <span className="text-sm text-white/20">—</span>
              )}
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: G, fontFamily: 'var(--font-heading)' }}>Gem. Bouwjaar</p>
              <p className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-heading)', color: AMBER, letterSpacing: '-0.02em' }}>
                {page.gemBouwjaar ?? '—'}
              </p>
              <p className="text-xs text-white/30 mt-1">BAG 2026</p>
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: G, fontFamily: 'var(--font-heading)' }}>Energy Score</p>
              <p className="text-2xl font-extrabold" style={{ fontFamily: 'var(--font-heading)', color: scoreColor, letterSpacing: '-0.02em' }}>
                {score}<span className="text-sm font-normal text-white/30">/100</span>
              </p>
              <p className="text-xs mt-1" style={{ color: scoreColor }}>{scorelabel}</p>
            </div>
          </div>

          <WijkCtaButton wijk={wijk} stad={stad}
            className={`inline-flex items-center gap-2 text-base ${amberBtnCls}`}
            style={{ fontFamily: 'var(--font-heading)' }}>
            Gratis mijn woning analyseren
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </WijkCtaButton>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/45 mt-6">
            {['BAG officiële data', 'AVG-compliant', 'Volledig gratis'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Urgentie Chart ──────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: N2 }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: G, fontFamily: 'var(--font-heading)' }}>
              2027 Urgentie
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              Besparing per jaar<br />in {wijkDisplay}
            </h2>
          </div>

          <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: G, fontFamily: 'var(--font-heading)' }}>Salderingsafbouw</p>
                <h3 className="text-lg font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
                  Wat kost wachten u in {wijkDisplay}?
                </h3>
              </div>
              <div className="bg-red-950/50 border border-red-700/60 rounded-xl px-4 py-3 shrink-0 text-right">
                <p className="text-xs font-semibold uppercase tracking-widest text-red-400/70 mb-0.5" style={{ fontFamily: 'var(--font-heading)' }}>Verlies vanaf 2027</p>
                <p className="text-xl font-extrabold text-red-400" style={{ fontFamily: 'var(--font-heading)' }}>
                  −€{verlies}<span className="text-xs font-normal text-red-400/60">/jaar</span>
                </p>
              </div>
            </div>

            <WijkSaldeerChart besparing={besparing} wijk={wijkDisplay} />

            <div className="mt-4 flex items-start gap-2 bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-amber-400 shrink-0 mt-0.5">
                <path d="M9 1.5L4 9h5L6 14.5l7-8.5H8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
              <p className="text-sm text-amber-300/80 leading-relaxed">
                <span className="font-bold text-amber-400">Shock 2027:</span>{' '}
                Verlies door saldering in {wijkDisplay}: <span className="font-bold text-amber-400">€{verlies} per jaar</span> vanaf 1 januari 2027 voor woningen zonder batterijopslag.
              </p>
            </div>

            <div className="mt-8">
              <CountdownTimer />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2-koloms content ────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: N1 }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: G, fontFamily: 'var(--font-heading)' }}>
              Wijkanalyse
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              Energieprofiel {wijkDisplay}
            </h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Links: analyse tekst (2/3 breed) */}
            <div className="lg:col-span-2 space-y-6">
              {analyse.length > 0 && (
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-7 transition-all hover:border-white/20">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: G, fontFamily: 'var(--font-heading)' }}>
                    Bouwtechnische analyse
                  </p>
                  <h3 className="font-extrabold text-lg mb-5 text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.01em' }}>
                    Woningkenmerken &amp; zonnepotentieel
                  </h3>
                  <div className="space-y-4">
                    {analyse.map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{renderBold(para)}</p>
                    ))}
                  </div>
                </div>
              )}

              {netwerk.length > 0 && (
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-7 transition-all hover:border-white/20">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: G, fontFamily: 'var(--font-heading)' }}>
                    Netwerkbeperkingen
                  </p>
                  <h3 className="font-extrabold text-lg mb-5 text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.01em' }}>
                    Netcapaciteit &amp; batterijopties
                  </h3>
                  <div className="space-y-4">
                    {netwerk.map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{renderBold(para)}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Rechts: Quick Facts */}
            <div>
              <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 sticky top-20">
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: G, fontFamily: 'var(--font-heading)' }}>
                  Quick Facts — {wijkDisplay}
                </p>

                <div className="space-y-3">
                  {[
                    { label: 'Gem. bouwjaar', value: page.gemBouwjaar ? `${page.gemBouwjaar}` : '—', sub: 'BAG registratie' },
                    { label: 'Energy Score', value: `${score}/100`, sub: scorelabel },
                    { label: 'Est. besparing', value: `€${besparing}/jr`, sub: 'zonder batterij, 2024' },
                    { label: 'Verlies 2027', value: `−€${verlies}/jr`, sub: 'bij 0% saldering', danger: true },
                    { label: 'Netcongestie', value: page.netcongestieStatus ?? '—', sub: net?.label ?? '' },
                    ...(page.aantalWoningen ? [{ label: 'Woningen', value: `${page.aantalWoningen.toLocaleString('nl')}`, sub: 'in dit postcodegebied' }] : []),
                    ...(ranking ? [{ label: 'Wijk Ranking', value: ranking.top ? 'Top 10%' : 'Top 25%', sub: 'rendement in ' + stadDisplay }] : []),
                  ].map(({ label, value, sub, danger }) => (
                    <div key={label} className="flex items-start justify-between gap-2 pb-3 border-b border-white/5 last:border-0 last:pb-0">
                      <div>
                        <p className="text-xs font-semibold text-white/50">{label}</p>
                        <p className="text-xs text-white/25">{sub}</p>
                      </div>
                      <span className={`text-sm font-extrabold shrink-0 ${danger ? 'text-red-400' : 'text-amber-400'}`}
                        style={{ fontFamily: 'var(--font-heading)' }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <WijkCtaButton wijk={wijk} stad={stad}
                  className={`mt-5 w-full flex items-center justify-center gap-2 text-sm py-3 ${amberBtnCls}`}
                  style={{ fontFamily: 'var(--font-heading)' }}>
                  Mijn adres scannen →
                </WijkCtaButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      {page.faqItems.length > 0 && (
        <section className="py-20 px-6" style={{ background: N2 }}>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: G, fontFamily: 'var(--font-heading)' }}>
                Veelgestelde vragen
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
                Alles over zonnepanelen<br />in {wijkDisplay}
              </h2>
            </div>
            <div className="space-y-3">
              {page.faqItems.map((faq, i) => (
                <div key={i} className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 sm:p-6 transition-all hover:border-white/20">
                  <h3 className="font-bold text-white mb-2" style={{ fontFamily: 'var(--font-heading)' }}>{faq.vraag}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{faq.antwoord}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Bottom CTA ──────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: N1 }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            Bereken wat {wijkDisplay}<br />
            <span style={{ color: AMBER }}>u kunt besparen</span>
          </h2>
          <p className="mb-6 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Voer uw adres in voor een analyse op maat — BAG-data, ROI-berekening en ISDE subsidie check in 3 minuten.
          </p>
          <AddressAutocomplete
            extraParams={{ wijk, stad }}
            placeholder={`Uw adres in ${wijkDisplay}, bijv. Hoofdstraat 1`}
          />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-5 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <span>✓ BAG-data</span>
            <span>✓ AVG-compliant</span>
            <span>✓ Geen account nodig</span>
          </div>
        </div>
      </section>

      {/* ── Andere wijken in stad ───────────────────────────────── */}
      {relatedWijken.length > 0 && (
        <section className="py-16 px-6" style={{ background: N2 }}>
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: G, fontFamily: 'var(--font-heading)' }}>
                Interne vergelijking
              </p>
              <h2 className="text-2xl font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
                Andere wijken in {stadDisplay}
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {relatedWijken.map((w) => {
                const ws = wijkScore(w.gem_bouwjaar, w.gem_health_score)
                return (
                  <a key={w.wijk} href={`/${provincie}/${stad}/${w.wijk}`}
                    className="bg-slate-900/40 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all hover:bg-slate-900/60 group">
                    <p className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors" style={{ fontFamily: 'var(--font-heading)' }}>
                      {toDisplay(w.wijk)}
                    </p>
                    <p className="text-xs font-mono mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Score {ws}/100 {w.gem_bouwjaar ? `· ${w.gem_bouwjaar}` : ''}
                    </p>
                  </a>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Kennisbank interne linking ──────────────────────────── */}
      <section className="py-10 px-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-4">Lees ook in de Kennisbank</p>
          <div className="flex flex-wrap gap-3">
            {(page.netcongestieStatus === 'ROOD'
              ? [
                  { slug: 'wat-is-salderen', titel: 'Wat is salderen?' },
                  { slug: 'einde-salderen-2027-uitleg', titel: 'Einde salderen 2027' },
                  { slug: 'netcongestie-problemen-nederland', titel: 'Netcongestie in Nederland' },
                ]
              : [
                  { slug: 'wat-is-salderen', titel: 'Wat is salderen?' },
                  { slug: 'einde-salderen-2027-uitleg', titel: 'Einde salderen 2027' },
                  { slug: 'thuisbatterij-saldering-alternatief', titel: 'Thuisbatterij als alternatief' },
                ]
            ).map(link => (
              <a
                key={link.slug}
                href={`/kennisbank/${link.slug}`}
                className="flex items-center gap-1.5 text-slate-400 hover:text-amber-300 transition-colors text-sm border border-white/10 rounded-lg px-3 py-2 hover:border-amber-500/30"
              >
                <svg className="w-3.5 h-3.5 text-amber-500/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {link.titel}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
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
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>© {new Date().getFullYear()} SaldeerScan.nl</p>
          </div>
        </div>
      </footer>

      {/* ── Sticky Mobile CTA ───────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 sm:hidden z-50 px-4 pb-4 pt-3"
        style={{ background: 'linear-gradient(to top, rgba(2,6,23,0.98) 60%, transparent)' }}>
        <WijkCtaButton wijk={wijk} stad={stad}
          className={`flex items-center justify-center gap-2 w-full py-4 text-base ${amberBtnCls}`}
          style={{ fontFamily: 'var(--font-heading)' }}>
          Start gratis Saldeercheck
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </WijkCtaButton>
      </div>
    </div>
  )
}
