import { cache } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getWijkPage, getTopWijken } from '@/lib/pseo'
import { LocalSchema } from '@/components/pseo/LocalSchema'
import { WijkSaldeerChart } from '@/components/pseo/WijkSaldeerChart'

const getCachedWijkPage = cache(getWijkPage)

export const revalidate = 2592000

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
    alternates: { canonical: `/${provincie}/${stad}/${wijk}` },
    openGraph: { title, description, type: 'website' },
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

function computeBesparing(bouwjaar: number | null, score: number): number {
  const base = bouwjaar
    ? bouwjaar < 1970 ? 720
    : bouwjaar < 1990 ? 960
    : bouwjaar < 2010 ? 840
    : 660
    : 780
  return Math.round(base * (score / 65))
}

// Split hoofdtekst into two sections for the 2-column layout
function splitContent(tekst: string | null): { analyse: string[]; netwerk: string[] } {
  if (!tekst) return { analyse: [], netwerk: [] }
  const paras = tekst.split('\n\n').filter(Boolean)
  const mid = Math.ceil(paras.length / 2)
  return { analyse: paras.slice(0, mid), netwerk: paras.slice(mid) }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function WijkPage({ params }: { params: Promise<Params> }) {
  const { provincie, stad, wijk } = await params
  const page = await getCachedWijkPage({ provincie, stad, wijk })
  if (!page) notFound()

  const wijkDisplay = toDisplay(wijk)
  const stadDisplay = toDisplay(stad)
  const score = wijkScore(page.gemBouwjaar, page.gemHealthScore)
  const { label: scorelabel, color: scoreColor } = scoreLabel(score)
  const besparing = computeBesparing(page.gemBouwjaar, score)
  const verlies = besparing
  const { analyse, netwerk } = splitContent(page.hoofdtekst)

  const netConfig = {
    ROOD:   { label: 'Vol stroomnet', dot: '#ef4444', cls: 'bg-red-950/50 border-red-700 text-red-400' },
    ORANJE: { label: 'Druk stroomnet', dot: '#f59e0b', cls: 'bg-amber-950/50 border-amber-700 text-amber-400' },
    GROEN:  { label: 'Vrij stroomnet', dot: '#10b981', cls: 'bg-emerald-950/50 border-emerald-700 text-emerald-400' },
  }
  const net = page.netcongestieStatus ? netConfig[page.netcongestieStatus as keyof typeof netConfig] : null

  const N1 = '#020617'
  const N2 = '#0f172a'
  const AMBER = '#f59e0b'
  const amberBtn = 'inline-flex items-center gap-2 font-bold px-8 py-4 rounded-full transition-all duration-200 bg-amber-500 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.45)] hover:scale-[1.02] hover:brightness-110 active:scale-[0.98]'

  return (
    <div className="min-h-screen pb-24 sm:pb-0" style={{ background: N1 }}>
      {page.jsonLd && Object.keys(page.jsonLd).length > 0 && <LocalSchema jsonLd={page.jsonLd} />}

      {/* ── Nav ───────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#00aa65' }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L15.5 6V13L9 17L2.5 13V6L9 2Z" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M9 6.5L12 8.5V12L9 14L6 12V8.5L9 6.5Z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-[#0e352e] tracking-tight text-lg" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              SaldeerScan<span style={{ color: '#00aa65' }}>.nl</span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-500 font-medium">
              {wijkDisplay}, {stadDisplay}
            </span>
            <a href={`/check?wijk=${encodeURIComponent(wijk)}&stad=${encodeURIComponent(stad)}`}
              className="text-sm font-bold px-5 py-2.5 rounded-full bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:brightness-110 transition-all">
              Gratis analyseren
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-14 pb-10" style={{ background: N1 }}>
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
        }} />
        {/* Amber glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(245,158,11,0.07)' }} />

        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: AMBER }}>
            // NEIGHBORHOOD INTELLIGENCE DASHBOARD
          </p>

          <h1 className="font-black text-white mb-2 leading-none"
            style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', letterSpacing: '-0.03em' }}>
            {wijkDisplay}
          </h1>
          <p className="text-lg mb-8 font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {stadDisplay} · {page.aantalWoningen ? `${page.aantalWoningen} woningen` : provincie}
          </p>

          {/* ── Data Ribbon ─────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto mb-10">
            {/* Grid Status */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-2">Grid Status</p>
              {net ? (
                <>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: net.dot }} />
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${net.cls}`}>
                      {page.netcongestieStatus}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-white/30">{net.label}</p>
                </>
              ) : (
                <span className="text-xs font-mono text-white/20">—</span>
              )}
            </div>

            {/* Build Year */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-2">Gem. Bouwjaar</p>
              <p className="text-2xl font-mono font-black" style={{ color: AMBER }}>
                {page.gemBouwjaar ?? '—'}
              </p>
              <p className="text-[10px] font-mono text-white/30 mt-1">[BAG_2026]</p>
            </div>

            {/* Energy Score */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-2">Energy Score</p>
              <p className="text-2xl font-mono font-black" style={{ color: scoreColor }}>
                {score}<span className="text-sm text-white/30">/100</span>
              </p>
              <p className="text-[10px] font-mono mt-1" style={{ color: scoreColor }}>{scorelabel}</p>
            </div>
          </div>

          <a href={`/check?wijk=${encodeURIComponent(wijk)}&stad=${encodeURIComponent(stad)}`}
            className={`text-base ${amberBtn}`}
            style={{ fontFamily: 'var(--font-heading)' }}>
            Start mijn gratis Saldeercheck
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </section>

      {/* ── Urgentie Chart ────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-1">2027 Urgentie — Salderingsafbouw</p>
              <h2 className="text-lg font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
                Besparing per jaar in {wijkDisplay}
              </h2>
            </div>
            <div className="bg-red-950/50 border border-red-700/60 rounded-xl px-4 py-3 shrink-0 text-right">
              <p className="text-[9px] font-mono uppercase tracking-widest text-red-400/70 mb-0.5">Verlies vanaf 2027</p>
              <p className="text-xl font-mono font-black text-red-400">−€{verlies}<span className="text-xs font-normal text-red-400/60">/jaar</span></p>
            </div>
          </div>

          <WijkSaldeerChart besparing={besparing} wijk={wijkDisplay} />

          <div className="mt-4 flex items-start gap-2 bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-3">
            <span className="text-amber-400 text-sm mt-0.5 shrink-0">⚡</span>
            <p className="text-xs font-mono text-amber-300/80 leading-relaxed">
              <span className="font-bold text-amber-400">Shock Label:</span>{' '}
              Verlies door saldering in {wijkDisplay}: <span className="font-bold text-amber-400">€{verlies} per jaar</span> vanaf 1 januari 2027 voor woningen zonder batterijopslag.
            </p>
          </div>
        </div>
      </section>

      {/* ── 2-koloms content ──────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-4">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Links: analyse tekst (2/3 breed) */}
          <div className="lg:col-span-2 space-y-6">
            {analyse.length > 0 && (
              <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-6 sm:p-7">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-amber-500/70">[ANALYSE]</span>
                  <h2 className="text-base font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                    Bouwtechnische Analyse
                  </h2>
                </div>
                <div className="space-y-4">
                  {analyse.map((para, i) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{renderBold(para)}</p>
                  ))}
                </div>
                <p className="text-[9px] font-mono mt-5" style={{ color: 'rgba(255,255,255,0.15)' }}>
                  [DATA_SOURCE: BAG_2026 · NETBEHEER_NL · ISDE_2026]
                </p>
              </div>
            )}

            {netwerk.length > 0 && (
              <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-6 sm:p-7">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-amber-500/70">[NETWERK]</span>
                  <h2 className="text-base font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                    Netwerkbeperkingen & Oplossingen
                  </h2>
                </div>
                <div className="space-y-4">
                  {netwerk.map((para, i) => (
                    <p key={i} className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{renderBold(para)}</p>
                  ))}
                </div>
                <p className="text-[9px] font-mono mt-5" style={{ color: 'rgba(255,255,255,0.15)' }}>
                  [DATA_SOURCE: NETBEHEER_NL_CONGESTIEKAART_2026]
                </p>
              </div>
            )}
          </div>

          {/* Rechts: Quick Facts */}
          <div className="space-y-4">
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 sticky top-20">
              <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-4">Quick Facts — {wijkDisplay}</p>

              <div className="space-y-3">
                {[
                  { label: 'Gem. bouwjaar', value: page.gemBouwjaar ? `${page.gemBouwjaar}` : '—', sub: 'BAG registratie' },
                  { label: 'Energy Score', value: `${score}/100`, sub: scorelabel },
                  { label: 'Est. besparing', value: `€${besparing}/jr`, sub: 'zonder batterij, 2024' },
                  { label: 'Verlies 2027', value: `−€${verlies}/jr`, sub: 'bij 0% saldering', danger: true },
                  { label: 'Netcongestie', value: page.netcongestieStatus ?? '—', sub: net?.label ?? '' },
                  ...(page.aantalWoningen ? [{ label: 'Woningen', value: `${page.aantalWoningen.toLocaleString('nl')}`, sub: 'in dit postcodegebied' }] : []),
                ].map(({ label, value, sub, danger }) => (
                  <div key={label} className="flex items-start justify-between gap-2 pb-3 border-b border-white/5 last:border-0 last:pb-0">
                    <div>
                      <p className="text-[10px] font-mono text-white/35">{label}</p>
                      <p className="text-[9px] font-mono text-white/20">{sub}</p>
                    </div>
                    <span className={`text-sm font-mono font-bold shrink-0 ${danger ? 'text-red-400' : 'text-amber-400'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <a href={`/check?wijk=${encodeURIComponent(wijk)}&stad=${encodeURIComponent(stad)}`}
                className="mt-5 w-full flex items-center justify-center gap-2 text-sm font-bold py-3 rounded-full bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:brightness-110 transition-all">
                Mijn adres scannen →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      {page.faqItems.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-10">
          <p className="text-[9px] font-mono uppercase tracking-widest text-white/30 mb-2">[FAQ]</p>
          <h2 className="text-xl font-extrabold text-white mb-6" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            Veelgestelde vragen
          </h2>
          <div className="space-y-3">
            {page.faqItems.map((faq, i) => (
              <div key={i} className="bg-slate-900/40 border border-white/10 rounded-2xl p-5 sm:p-6">
                <h3 className="font-bold text-white mb-2 text-sm" style={{ fontFamily: 'var(--font-heading)' }}>{faq.vraag}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{faq.antwoord}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Bottom CTA ────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-6 pb-16">
        <div className="text-center bg-slate-900/60 border border-white/10 rounded-2xl p-10"
          style={{ boxShadow: '0 0 60px rgba(245,158,11,0.05)' }}>
          <p className="text-[9px] font-mono uppercase tracking-widest mb-4" style={{ color: AMBER }}>[CONVERSIE]</p>
          <h2 className="text-2xl font-extrabold text-white mb-3" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            Uw persoonlijk investeringsrapport
          </h2>
          <p className="mb-6 text-sm max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Gratis AI-scan voor uw specifieke woning in {wijkDisplay}. BAG-data, ROI-berekening en ISDE subsidie check in 3 minuten.
          </p>
          <a href={`/check?wijk=${encodeURIComponent(wijk)}&stad=${encodeURIComponent(stad)}`}
            className={`text-base ${amberBtn}`} style={{ fontFamily: 'var(--font-heading)' }}>
            Start gratis Saldeercheck
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <p className="mt-4 text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            ✓ Geen account · ✓ AVG-compliant · ✓ [DATA_SOURCE: BAG_2026]
          </p>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t px-6 py-8 text-center" style={{ borderColor: 'rgba(255,255,255,0.06)', background: N1 }}>
        <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>© 2026 SaldeerScan.nl</p>
      </footer>

      {/* ── Sticky Mobile CTA ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 sm:hidden z-50 px-4 pb-4 pt-3"
        style={{ background: 'linear-gradient(to top, rgba(2,6,23,0.98) 60%, transparent)' }}>
        <a href={`/check?wijk=${encodeURIComponent(wijk)}&stad=${encodeURIComponent(stad)}`}
          className="flex items-center justify-center gap-2 w-full py-4 rounded-full text-base font-bold bg-amber-500 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.5)] active:scale-[0.98] transition-all"
          style={{ fontFamily: 'var(--font-heading)' }}>
          Start gratis Saldeercheck
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>
    </div>
  )
}
