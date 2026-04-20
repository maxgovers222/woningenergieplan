'use client'

import { useEffect, useRef, useState } from 'react'
import type { FunnelState } from './types'
import { PDFDownloadButton } from './PDFDownloadButton'

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
      <div className="bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border-2 border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]">
        ✓ Gevalideerd 2027
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

      {/* Volgende stap */}
      <div className="bg-slate-900/40 border border-amber-500/15 rounded-2xl p-6 print-break-avoid">
        <p className="text-xs font-semibold text-amber-400 mb-1" style={{ fontFamily: 'var(--font-heading)' }}>Volgende stap</p>
        <h3 className="text-base font-bold text-white mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
          Een energieadviseur neemt contact op
        </h3>
        <p className="text-sm text-white/50 mb-5 leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
          Uw dossier wordt bekeken door een energieadviseur in {regio}. Hij berekent de exacte configuratie en neemt zo spoedig mogelijk contact op.
        </p>
        <a
          href="/check"
          className="no-print w-full flex items-center justify-center gap-2 font-bold py-3.5 px-6 rounded-full text-sm text-slate-950 bg-amber-500 hover:brightness-105 active:scale-[0.98] transition-all duration-200 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
          </svg>
          Bespreek dit rapport met een expert
        </a>
      </div>

      {/* Download */}
      <div className="space-y-3 no-print">
        <PDFDownloadButton state={state} />
        <button
          onClick={() => window.print()}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full font-semibold text-sm border border-white/10 bg-white/5 text-white/50 hover:bg-white/8 hover:text-white/70 transition-all"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Afdrukken / opslaan als PDF
        </button>
      </div>

      {/* Volgende stappen */}
      <div className="bg-slate-900/40 border border-white/8 rounded-xl p-5 print-break-avoid">
        <p className="text-xs font-semibold text-white/50 mb-4" style={{ fontFamily: 'var(--font-sans)' }}>Wat gebeurt er verder?</p>
        <div className="space-y-3">
          {[
            { nr: '1', text: 'Expert bekijkt uw dossier', done: true },
            { nr: '2', text: 'Gratis inspectie op locatie', done: false },
            { nr: '3', text: 'Persoonlijke offerte op maat', done: false },
            { nr: '4', text: 'ISDE subsidie aanvraag begeleiding', done: false },
          ].map(({ nr, text, done }) => (
            <div key={nr} className="flex items-center gap-3 text-sm">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${done ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'bg-white/5 border border-white/10 text-white/25'}`}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : nr}
              </div>
              <span className={done ? 'text-white/70' : 'text-white/35'} style={{ fontFamily: 'var(--font-sans)' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-white/20 text-center pb-2" style={{ fontFamily: 'var(--font-sans)' }}>
        © 2026 SaldeerScan.nl · AVG-compliant · Rapport gegenereerd op {new Date().toLocaleDateString('nl-NL')}
      </p>
    </div>
  )
}
