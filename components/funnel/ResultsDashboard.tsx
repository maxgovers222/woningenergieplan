'use client'

import { useEffect, useRef, useState } from 'react'
import type { FunnelState } from './types'
import { PDFDownloadButton } from './PDFDownloadButton'

function ReferralButtons({ stad }: { stad?: string }) {
  const [copied, setCopied] = useState(false)
  const waUrl = `https://saldeerscan.nl/check?ref=buur&utm_source=referral&utm_medium=whatsapp`
  const copyUrl = `https://saldeerscan.nl/check?ref=buur&utm_source=referral&utm_medium=copy`
  const stadLabel = stad ? stad.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Nederland'
  const waText = encodeURIComponent(`Ik heb net mijn huis laten scannen voor de 2027 salderingswijziging via SaldeerScan.nl. Jij loopt hetzelfde risico in ${stadLabel}! Doe hier de gratis check: ${waUrl}`)

  function handleCopy() {
    navigator.clipboard.writeText(copyUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="flex gap-3 flex-wrap">
      <a
        href={`https://wa.me/?text=${waText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-colors"
        style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', color: '#25d366' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.115 1.532 5.836L.057 23.927l6.256-1.641A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-5.003-1.373l-.358-.214-3.718.975.993-3.62-.234-.372A9.786 9.786 0 012.182 12C2.182 6.573 6.573 2.182 12 2.182S21.818 6.573 21.818 12 17.427 21.818 12 21.818z"/>
        </svg>
        Deel via WhatsApp
      </a>
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono transition-colors"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: copied ? '#34d399' : 'rgba(255,255,255,0.5)' }}
      >
        {copied ? (
          <><svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8l4 4 8-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Gekopieerd!</>
        ) : (
          <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Kopieer link</>
        )}
      </button>
    </div>
  )
}

function useCountUp(target: number, duration = 1400): number {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (target === 0) return
    const start = performance.now()
    const tick = (now: number) => {
      const pct = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - pct, 3)
      setVal(Math.round(eased * target))
      if (pct < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

function ShockChart({ besparing }: { besparing: number }) {
  const years = [
    { year: '2024', pct: 100, label: '100%', color: '#10b981' },
    { year: '2025', pct: 64,  label: '64%',  color: '#f59e0b' },
    { year: '2026', pct: 28,  label: '28%',  color: '#f97316' },
    { year: '2027', pct: 0,   label: '0%',   color: '#ef4444' },
  ]
  const [animated, setAnimated] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 200); return () => clearTimeout(t) }, [])

  return (
    <div className="space-y-3">
      {years.map(({ year, pct, label, color }) => (
        <div key={year} className="flex items-center gap-3">
          <span className="text-xs font-mono text-white/40 w-10 shrink-0">{year}</span>
          <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: animated ? `${Math.max(pct, 2)}%` : '0%',
                background: color,
                transitionDelay: `${years.findIndex(y => y.year === year) * 150}ms`,
              }}
            />
          </div>
          <span className="text-xs font-mono w-10 shrink-0 text-right" style={{ color }}>{label}</span>
          <span className="text-xs font-mono text-white/30 w-24 shrink-0 hidden sm:block">
            {pct > 0 ? `€${Math.round(besparing * pct / 100).toLocaleString('nl-NL')}/jr` : '€0/jr'}
          </span>
        </div>
      ))}
    </div>
  )
}

function ROITijdlijn({ terugverdien, besparing }: { terugverdien: number; besparing: number }) {
  const startYear = new Date().getFullYear()
  const milestones = [
    { jaar: startYear, label: 'Installatie', kleur: '#f59e0b', icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9 1.5L4 9h5L6 14.5l7-8.5H8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
    )},
    { jaar: startYear + Math.round(terugverdien / 2), label: 'Halverwege', kleur: '#f97316', icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 11l4-4 3 3 5.5-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M10.5 4h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
    )},
    { jaar: startYear + Math.round(terugverdien), label: 'Terugverdiend', kleur: '#10b981', icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 8l3.5 3.5 7.5-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    )},
    { jaar: startYear + 15, label: '15 jaar winst', kleur: '#10b981', icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1.5l1.6 3.9 4.4.4-3.2 3 .9 4.3L8 10.8l-3.7 2.3.9-4.3L2 5.8l4.4-.4z"/></svg>
    )},
  ]

  return (
    <div className="relative">
      <div className="absolute top-5 left-5 right-5 h-px bg-white/8" />
      <div className="relative flex justify-between">
        {milestones.map((m, i) => (
          <div key={i} className="flex flex-col items-center gap-2.5 flex-1">
            <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 bg-slate-950"
              style={{ borderColor: m.kleur, color: m.kleur }}>
              {m.icon}
            </div>
            <div className="text-center">
              <p className="text-xs font-bold font-mono" style={{ color: m.kleur }}>{m.jaar}</p>
              <p className="text-[10px] text-white/40 leading-tight mt-0.5" style={{ fontFamily: 'var(--font-sans)' }}>{m.label}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 bg-emerald-950/30 border border-emerald-700/30 rounded-xl px-4 py-3 text-center">
        <p className="text-xs text-emerald-400" style={{ fontFamily: 'var(--font-sans)' }}>
          Na {terugverdien} jaar verdient u <strong>€{Math.round(besparing * (15 - terugverdien)).toLocaleString('nl-NL')}</strong> netto winst over 15 jaar
        </p>
      </div>
    </div>
  )
}

function GevalideerdStempel() {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 800); return () => clearTimeout(t) }, [])
  return (
    <div className={`absolute -top-3 -right-3 transition-all duration-500 ${visible ? 'opacity-100 scale-100 rotate-12' : 'opacity-0 scale-50 rotate-0'}`}>
      <div className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)] flex items-center gap-0.5">
        <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Gevalideerd 2027
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 opacity-50" style={{ fontFamily: 'var(--font-sans)' }}>
      {children}
    </p>
  )
}

export function ResultsDashboard({ state }: { state: FunnelState }) {
  const roi = state.roiResult
  const score = state.healthScore?.score ?? 0
  const besparing = roi?.scenarioNu.besparingJaarEur ?? 0
  const verlies = roi?.shockEffect2027.jaarlijksVerlies ?? besparing
  const terugverdien = roi?.scenarioNu.terugverdientijdJaar ?? 8
  const investering = roi?.scenarioNu.investeringEur ?? 0
  const regio = state.wijk ? state.wijk.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : (state.stad || 'uw regio')

  const animBesparing = useCountUp(besparing, 1600)
  const animVerlies   = useCountUp(verlies, 1800)
  const animScore     = useCountUp(score, 1200)

  return (
    <div className="print-page space-y-6 py-2">

      {/* Huurder waarschuwing */}
      {state.is_eigenaar === false && (
        <div className="p-4 bg-amber-950/20 border border-amber-500/25 rounded-xl">
          <p className="text-sm font-sans text-amber-300/80 leading-relaxed">
            <strong className="text-amber-300">Let op: u heeft aangegeven huurder te zijn.</strong>{' '}
            Overleg eerst met uw verhuurder of woningcorporatie — wij sturen uw rapport ter informatie.
            Zonnepanelen zijn in huurwoningen steeds vaker mogelijk.
          </p>
        </div>
      )}

      {/* Netcongestie ROOD callout */}
      {state.netcongestie?.status === 'ROOD' && (
        <div className="p-4 bg-amber-950/20 border border-amber-500/25 rounded-xl">
          <p className="text-sm font-sans text-amber-300/80 leading-relaxed">
            <strong className="text-amber-300">Netcongestie in uw wijk.</strong>{' '}
            Uw terugleving kan beperkt zijn door netcapaciteitstekort.
            Een thuisbatterij is extra waardevol — u slaat overdag op wat u 's avonds gebruikt.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <p className="text-xs text-white/40 mb-0.5" style={{ fontFamily: 'var(--font-sans)' }}>Persoonlijk investeringsrapport</p>
          <h2 className="text-xl font-black text-white" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
            Uw SaldeerScan rapport
          </h2>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-950/50 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {state.adres && (
        <div className="bg-slate-900/40 border border-white/8 rounded-xl px-4 py-3">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-0.5" style={{ fontFamily: 'var(--font-sans)' }}>Adres</p>
          <p className="text-sm font-mono text-white/80">{state.adres}</p>
        </div>
      )}

      {/* Sectie 1: De Shock */}
      <div className="bg-slate-900/40 border border-red-700/25 rounded-2xl p-6 print-break-avoid">
        <SectionLabel>Impact 2027</SectionLabel>
        <h3 className="text-base font-bold text-white mb-5" style={{ fontFamily: 'var(--font-heading)' }}>
          Jaarlijks saldeer-verlies na 1 januari 2027
        </h3>

        <div className="text-center mb-6">
          <div className="text-5xl font-black font-mono mb-1.5" style={{ color: '#f59e0b' }}>
            −€{animVerlies.toLocaleString('nl-NL')}
          </div>
          <p className="text-xs text-white/40" style={{ fontFamily: 'var(--font-sans)' }}>per jaar · vanaf 1 januari 2027</p>
        </div>

        <ShockChart besparing={besparing} />

        <div className="mt-4 bg-red-950/30 border border-red-700/30 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-red-400 shrink-0 mt-0.5">
            <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <p className="text-xs text-red-300" style={{ fontFamily: 'var(--font-sans)' }}>
            Zonder actie verliest u over 5 jaar <strong className="text-red-200">€{((verlies ?? 0) * 5).toLocaleString('nl-NL')}</strong> aan salderingsinkomsten
          </p>
        </div>
      </div>

      {/* Sectie 2: De Oplossing */}
      <div className="bg-slate-900/40 border border-emerald-700/25 rounded-2xl p-6 relative print-break-avoid">
        <GevalideerdStempel />
        <SectionLabel>Geadviseerde configuratie</SectionLabel>
        <h3 className="text-base font-bold text-white mb-5" style={{ fontFamily: 'var(--font-heading)' }}>
          Uw optimale opstelling
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-950/60 border border-amber-500/15 rounded-xl p-4">
            <p className="text-[10px] text-amber-400/70 uppercase tracking-widest mb-1.5" style={{ fontFamily: 'var(--font-sans)' }}>Zonnepanelen</p>
            <p className="text-2xl font-black font-mono text-amber-400">{roi?.aantalPanelen ?? '—'}</p>
            <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: 'var(--font-sans)' }}>panelen · {roi ? Math.round((roi.aantalPanelen ?? 8) * 0.4) : '—'} m²</p>
          </div>
          <div className="bg-slate-950/60 border border-emerald-500/15 rounded-xl p-4">
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-widest mb-1.5" style={{ fontFamily: 'var(--font-sans)' }}>Thuisbatterij</p>
            <p className="text-2xl font-black font-mono text-emerald-400">10 kWh</p>
            <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: 'var(--font-sans)' }}>aanbevolen</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Besparing/jaar', value: `€${animBesparing.toLocaleString('nl-NL')}`, color: '#f59e0b' },
            { label: 'Investering', value: investering > 0 ? `€${investering.toLocaleString('nl-NL')}` : '—', color: 'rgba(255,255,255,0.6)' },
            { label: 'Energie score', value: `${animScore}/100`, color: score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-950/40 rounded-xl p-3">
              <p className="text-[10px] text-white/30 mb-1" style={{ fontFamily: 'var(--font-sans)' }}>{label}</p>
              <p className="font-bold font-mono text-sm" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {roi?.isdeSchatting && roi.isdeSchatting.bedragEur > 0 && (
          <div className="mt-3 bg-amber-950/20 border border-amber-500/15 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-amber-400/70 uppercase tracking-widest" style={{ fontFamily: 'var(--font-sans)' }}>ISDE Subsidie</p>
              <p className="text-sm font-bold font-mono text-amber-400">€{roi.isdeSchatting.bedragEur.toLocaleString('nl-NL')}</p>
            </div>
            <p className="text-[11px] text-white/30 text-right" style={{ fontFamily: 'var(--font-sans)' }}>via RVO<br/>subsidieregeling</p>
          </div>
        )}
      </div>

      {/* Sectie 3: ROI Tijdlijn */}
      <div className="bg-slate-900/40 border border-white/8 rounded-2xl p-6 print-break-avoid">
        <SectionLabel>Terugverdientijd</SectionLabel>
        <h3 className="text-base font-bold text-white mb-6" style={{ fontFamily: 'var(--font-heading)' }}>
          ROI tijdlijn
        </h3>
        <ROITijdlijn terugverdien={terugverdien} besparing={besparing} />
      </div>

      {/* Wat gebeurt er nu */}
      <div className="bg-slate-900/40 border border-amber-500/15 rounded-2xl p-6 print-break-avoid">
        <p className="text-xs font-semibold text-amber-400 mb-4" style={{ fontFamily: 'var(--font-heading)' }}>Wat gebeurt er nu?</p>
        <div className="space-y-4">
          {[
            { dot: 'amber', label: 'Uw aanvraag is geregistreerd', timing: 'nu' },
            { dot: 'amber', label: 'Een adviseur neemt zo spoedig mogelijk contact met u op', timing: '' },
            { dot: 'green', label: 'Vrijblijvende offerte op maat', timing: '' },
          ].map(({ dot, label, timing }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`mt-1 w-2 h-2 rounded-full shrink-0 animate-pulse ${dot === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <div className="flex-1 flex items-baseline justify-between gap-2 min-w-0">
                <span className="text-sm text-white/70 font-sans leading-snug">{label}</span>
                <span className={`text-[10px] font-mono shrink-0 ${dot === 'amber' ? 'text-amber-400' : 'text-emerald-400'}`}>{timing}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-mono text-white/20 mt-4">
          Nog geen contact ontvangen? Mail ons: info@saldeerscan.nl
        </p>
      </div>

      {/* Referral */}
      <div className="bg-slate-900/40 border border-amber-500/15 rounded-2xl p-5 no-print">
        <p className="text-xs font-semibold text-amber-400 mb-1" style={{ fontFamily: 'var(--font-heading)' }}>Uw buur mist dit misschien ook</p>
        <p className="text-sm text-white/50 mb-4 font-sans">
          Stuur dit rapport door aan uw buren{state.stad ? ` in ${state.stad.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}` : ''} — zij lopen hetzelfde 2027-risico.
        </p>
        <ReferralButtons stad={state.stad} />
      </div>

      {/* Download */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <div className="flex-1">
          <PDFDownloadButton state={state} />
        </div>
        <button
          onClick={() => window.print()}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm border border-white/10 bg-white/5 text-white/40 hover:bg-white/8 hover:text-white/60 transition-all"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Afdrukken
        </button>
      </div>

      <p className="text-[10px] text-white/20 text-center pb-2" style={{ fontFamily: 'var(--font-sans)' }}>
        © 2026 SaldeerScan.nl · AVG-compliant · Rapport gegenereerd op {new Date().toLocaleDateString('nl-NL')}
      </p>
    </div>
  )
}
