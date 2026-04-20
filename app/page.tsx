'use client'

import { CountdownTimer } from '@/components/CountdownTimer'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'

/* ─── Palette tokens ──────────────────────────────── */
const G     = '#00aa65'   // brand green (accenten, logo)
const AMBER = '#f59e0b'   // amber CTA
const N1    = '#020617'   // deep navy (hero + footer)
const N2    = '#0f172a'   // navy mid (secties)

/* ─── Amber button classes ────────────────────────── */
const amberBtnCls = [
  'bg-amber-500 text-slate-950 font-bold rounded-full',
  'transition-all duration-300',
  'shadow-[0_0_25px_rgba(245,158,11,0.4)]',
  'hover:opacity-90 active:scale-105',
  'disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100',
].join(' ')

/* ─── NavBar ──────────────────────────────────────── */
function NavBar() {
  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
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
          <a href="/check" className="hidden sm:block text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium">
            Hoe het werkt
          </a>
          <a href="/check" className={`text-sm px-5 py-2.5 ${amberBtnCls}`}>
            Gratis analyseren
          </a>
        </div>
      </div>
    </nav>
  )
}

/* ─── Hero ────────────────────────────────────────── */
function HeroSection() {
  return (
    <section className="relative overflow-hidden" style={{ background: N1 }}>
      {/* SVG grid — alleen hero, vervaagt naar beneden */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true"
        style={{ opacity: 0.03, maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)' }}>
        <defs>
          <pattern id="hero-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgb(100,116,139)" strokeOpacity="0.3" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>
      {/* Zachte radiale gloed boven */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `radial-gradient(ellipse 70% 50% at 50% -5%, rgba(0,170,101,0.14) 0%, transparent 70%)`,
      }} />

      <div className="relative max-w-4xl mx-auto px-6 py-24 sm:py-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
          style={{ background: G, color: 'white', fontFamily: 'var(--font-heading)' }}>
          <span className="w-1.5 h-1.5 bg-white rounded-full opacity-80" />
          Gratis analyse — 2027 saldering vervalt
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-6"
          style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.03em', lineHeight: 1.05 }}>
          Uw woning klaar<br />
          <span style={{ color: AMBER }}>voor 2027</span>
        </h1>

        <p className="text-lg text-white/65 max-w-xl mx-auto mb-10 leading-relaxed">
          Saldering stopt 1 januari 2027. Wij berekenen gratis wat u nu kunt doen —
          met BAG-data, AI-analyse en een persoonlijk energieplan.
        </p>

        <AddressAutocomplete />

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/45 mb-12">
          {['BAG officiële data', 'AVG-compliant', 'Volledig gratis'].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {t}
            </span>
          ))}
        </div>

        <CountdownTimer />
      </div>
    </section>
  )
}

/* ─── Urgentie 2027 strip ─────────────────────────── */
function UrgentieStrip() {
  return (
    <div className="border-y border-amber-500/20 py-3 px-6" style={{ background: 'rgba(28,18,8,0.95)' }}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-center">
        <span className="text-amber-400 font-sans text-xs font-bold tracking-widest uppercase shrink-0">Deadline 1 jan 2027</span>
        <span className="hidden sm:inline text-amber-500/30">·</span>
        <span className="text-amber-200/60 text-xs">Saldering: <strong className="text-amber-200/80">28% (2026) → 0% (2027)</strong> — Elke maand wachten kost u saldeervoordeel dat u nooit meer terugkrijgt.</span>
        <a href="/check" className="sm:ml-2 text-xs font-bold text-amber-400 hover:text-amber-300 underline whitespace-nowrap transition-colors">
          Bereken uw verlies →
        </a>
      </div>
    </div>
  )
}

/* ─── Hoe werkt het ───────────────────────────────── */
function HoeWerktHet() {
  const steps = [
    { num: 1, titel: 'Voer uw adres in', tekst: 'Wij halen direct bouwjaar, oppervlakte en dakgrootte op uit het officiële BAG-register.' },
    { num: 2, titel: 'AI scant uw woning', tekst: 'Upload een foto van uw meterkast. Onze AI beoordeelt geschiktheid voor zonnepanelen en batterij.' },
    { num: 3, titel: 'Ontvang uw energieplan', tekst: 'U krijgt een persoonlijk ROI-rapport en een offerte van een gecertificeerde installateur.' },
  ]

  return (
    <section className="py-20 px-6" style={{ background: N2 }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: G, fontFamily: 'var(--font-heading)' }}>
            Hoe het werkt
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            Van adres naar energieplan<br />in 3 minuten
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.num} className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-7">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg mb-5"
                style={{ background: G, fontFamily: 'var(--font-heading)' }}>
                {step.num}
              </div>
              <h3 className="font-bold text-lg mb-2 text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.01em' }}>
                {step.titel}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{step.tekst}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <a href="/check" className={`inline-flex items-center gap-2 text-sm px-8 py-4 ${amberBtnCls}`}>
            Start gratis analyse
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        </div>
      </div>
    </section>
  )
}

/* ─── Feiten strip ────────────────────────────────── */
function FeitenStrip() {
  const stats = [
    { display: '28%',   label: 'Saldering 2026',  sub: 'Nog beschikbaar dit jaar' },
    { display: '0%',    label: 'Saldering 2027',  sub: 'Wet aangenomen, onherroepelijk' },
    { display: '8,7M+', label: 'Adressen in BAG', sub: 'Officieel RVO-register' },
    { display: '€0',    label: 'Kosten analyse',  sub: 'Volledig gratis' },
  ]

  return (
    <section className="py-14 px-6" style={{ background: N1 }}>
      <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-4xl font-extrabold mb-1" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: AMBER }}>
              {s.display}
            </div>
            <div className="text-sm font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{s.label}</div>
            <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ─── USP sectie ──────────────────────────────────── */
function UspSection() {
  const usps = [
    {
      icon: <path d="M3 9l4 4L17 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
      titel: 'BAG-register data',
      tekst: 'Officiële overheidsdata: bouwjaar, oppervlakte en dakoppervlak direct uit het kadaster.',
    },
    {
      icon: <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M15.66 15.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M15.66 8.34l2.12-2.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
      titel: 'AI analyse',
      tekst: 'Gemini + Claude AI scant uw meterkast, plaatsingslocatie en omvormer op geschiktheid.',
    },
    {
      icon: <><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
      titel: 'Persoonlijke ROI',
      tekst: 'Uw besparing per scenario: nu, met batterij, en wat wachten u kost na 2027.',
    },
    {
      icon: <><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
      titel: 'Privacy first',
      tekst: 'Uw data wordt nooit gedeeld zonder toestemming. GDPR-compliant, geen verborgen verplichtingen.',
    },
    {
      icon: <><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
      titel: 'Netcongestie check',
      tekst: 'Wij controleren of uw stroomnet vol is — bepalend voor of een thuisbatterij prioriteit heeft.',
    },
    {
      icon: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>,
      titel: 'Gecertificeerde installateurs',
      tekst: 'Alleen keurmerk-geverifieerde installateurs. Vrijblijvende offerte, altijd gecertificeerd.',
    },
  ]

  return (
    <section className="py-20 px-6" style={{ background: N2 }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: G, fontFamily: 'var(--font-heading)' }}>
            Waarom SaldeerScan
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            Alles in één gratis analyse
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {usps.map((usp) => (
            <div key={usp.titel} className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,170,101,0.15)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: G }}>
                  {usp.icon}
                </svg>
              </div>
              <h3 className="font-bold mb-2 text-base text-white" style={{ fontFamily: 'var(--font-heading)' }}>{usp.titel}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{usp.tekst}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── CTA sectie ──────────────────────────────────── */
function CtaSection() {
  return (
    <section className="py-20 px-6" style={{ background: N1 }}>
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
          Bereken nu wat u<br />
          <span style={{ color: AMBER }}>kunt besparen</span>
        </h2>
        <p className="mb-8 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Gratis, geen account, geen verplichtingen. In 3 minuten heeft u een persoonlijk energierapport.
        </p>
        <a href="/check" className={`inline-flex items-center gap-2 text-base px-10 py-4 ${amberBtnCls}`}>
          Start gratis analyse
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </a>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <span>✓ BAG-data</span>
          <span>✓ AVG-compliant</span>
          <span>✓ Geen creditcard</span>
        </div>
      </div>
    </section>
  )
}

/* ─── Footer ──────────────────────────────────────── */
function Footer() {
  return (
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
          <a href="/check"
            className={`text-sm px-6 py-3 ${amberBtnCls}`}>
            Gratis analyseren
          </a>
        </div>
        <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex gap-6 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <a href="/privacy" className="hover:text-white/50 transition-colors">Privacyverklaring</a>
            <a href="/check" className="hover:text-white/50 transition-colors">Analyseer uw woning</a>
          </div>
          <p className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>© {new Date().getFullYear()} SaldeerScan.nl</p>
        </div>
      </div>
    </footer>
  )
}

/* ─── Page ────────────────────────────────────────── */
export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <HeroSection />
      <UrgentieStrip />
      <HoeWerktHet />
      <FeitenStrip />
      <UspSection />
      <CtaSection />
      <Footer />
    </div>
  )
}
