'use client'

import { useState, useEffect, useRef, type Dispatch } from 'react'
import type { FunnelState, FunnelAction, ROIResult } from './types'
import { Shock2027Banner } from './Shock2027Banner'
import { StepHeader } from './StepHeader'
import { schatVerbruik } from '@/lib/roi'

interface Step2ROIProps {
  state: FunnelState
  dispatch: Dispatch<FunnelAction>
}

const amberBtnCls = 'bg-amber-500 text-slate-950 font-bold rounded-full transition-all duration-300 shadow-[0_0_35px_rgba(245,158,11,0.5)] hover:opacity-90 active:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100'

function ScenarioCard({ scenario, variant, recommended }: {
  scenario: { naam: string; beschrijving: string; besparingJaarEur: number; investeringEur: number; terugverdientijdJaar: number }
  variant: 'amber' | 'emerald' | 'red'
  recommended?: boolean
}) {
  const borderClass = recommended
    ? 'border-emerald-500/50 ring-2 ring-emerald-500/20'
    : variant === 'amber' ? 'border-amber-500/50'
    : variant === 'emerald' ? 'border-emerald-500/50'
    : 'border-red-700/40'
  const labelClass = variant === 'amber' ? 'text-amber-400' : variant === 'emerald' ? 'text-emerald-400' : 'text-red-400'
  const bgClass = variant === 'red' ? 'bg-red-950/20' : 'bg-slate-900/40'

  return (
    <div className={`${bgClass} border ${borderClass} rounded-xl p-4 ${variant === 'red' ? 'opacity-70' : ''} relative`}>
      {recommended && (
        <span className="absolute -top-2.5 left-4 text-[10px] font-bold font-mono bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">
          Aanbevolen
        </span>
      )}
      <div className={`text-[10px] font-mono uppercase tracking-widest mb-1 ${labelClass}`}>{scenario.naam}</div>
      <p className="text-xs text-white/40 mb-3 font-mono">{scenario.beschrijving}</p>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-white/40 font-mono">Besparing/jaar</span>
          <span className={`font-mono font-bold text-lg ${labelClass}`}>€{scenario.besparingJaarEur.toLocaleString('nl-NL')}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-white/40 font-mono">Investering</span>
          <span className="font-mono text-white/60 text-sm">€{scenario.investeringEur.toLocaleString('nl-NL')}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-white/40 font-mono">Terugverdientijd</span>
          <span className="font-mono text-white/60 text-sm">{scenario.terugverdientijdJaar >= 99 ? '—' : `${scenario.terugverdientijdJaar} jaar`}</span>
        </div>
      </div>
      {variant === 'red' && (
        <div className="mt-3 pt-3 border-t border-red-700/30">
          <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">Saldering vervalt 1 jan 2027</span>
        </div>
      )}
    </div>
  )
}

function SliderInput({ label, value, onChange, min, max, step, unit, note }: {
  label: string; value: number; onChange: (v: number) => void
  min: number; max: number; step: number; unit: string; note?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-mono text-white/40 uppercase tracking-widest">{label}</label>
        <span className="font-mono font-bold text-amber-400 text-sm">{value.toLocaleString('nl-NL')} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500
          [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-amber-400 accent-amber-500" />
      <div className="flex justify-between text-[10px] font-mono text-white/30">
        <span>{min.toLocaleString('nl-NL')} {unit}</span>
        {note && <span className="italic">{note}</span>}
        <span>{max.toLocaleString('nl-NL')} {unit}</span>
      </div>
    </div>
  )
}

export function Step2ROI({ state, dispatch }: Step2ROIProps) {
  const dakMax = Math.max(100, state.bagData?.dakOppervlakte ?? 100)

  const geschatVerbruik = state.bagData
    ? schatVerbruik(state.bagData.oppervlakte, state.bagData.bouwjaar)
    : 3500
  const verbruikMax = Math.max(25000, (state.bagData?.oppervlakte ?? 0) * 40)

  const [verbruik, setVerbruik] = useState<number>(state.roiResult?.geschatVerbruikKwh ?? geschatVerbruik)
  const [dakOpp, setDakOpp] = useState<number>(Math.min(state.bagData?.dakOppervlakte ?? 35, dakMax))
  const panelenMax = Math.max(40, Math.floor((dakMax * 0.70) / 4))
  const [panelen, setPanelen] = useState<number>(state.roiResult?.aantalPanelen ?? Math.floor((dakMax * 0.55) / 4) || 10)
  const [localRoi, setLocalRoi] = useState<ROIResult | null>(state.roiResult ?? null)
  const [loading, setLoading] = useState(false)
  const [roiError, setRoiError] = useState<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasLoadedOnce = useRef(false)

  useEffect(() => {
    if (!state.bagData?.oppervlakte || !state.bagData?.bouwjaar) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    const delay = hasLoadedOnce.current ? 500 : 0
    hasLoadedOnce.current = true
    debounceTimer.current = setTimeout(async () => {
      setLoading(true)
      setRoiError(null)
      try {
        const res = await fetch('/api/roi', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oppervlakte: state.bagData!.oppervlakte,
            bouwjaar: state.bagData!.bouwjaar,
            dakOppervlakte: dakOpp,
            huidigVerbruikKwh: verbruik,
            aantalPanelenOverride: panelen,
            netcongestieStatus: state.netcongestie?.status,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setLocalRoi(data.roi)
          dispatch({ type: 'SET_ROI', roiResult: data.roi })
          if (data.health) dispatch({ type: 'SET_HEALTH_SCORE', healthScore: data.health })
        } else {
          setRoiError('Herberekening mislukt. Probeer opnieuw.')
        }
      } catch {
        setRoiError('Herberekening mislukt. Controleer uw verbinding.')
      } finally { setLoading(false) }
    }, delay)
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verbruik, dakOpp, panelen])

  const roi = localRoi

  return (
    <div className="p-6 space-y-6">
      <StepHeader stap="// STAP 02 — ROI BEREKENING" title="Uw besparingsanalyse" subtitle="Pas de sliders aan voor een persoonlijke berekening" />

      <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4 space-y-5">
        <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Parameters</div>
        <SliderInput label="Huidig verbruik" value={verbruik} onChange={setVerbruik} min={1000} max={verbruikMax} step={100} unit="kWh/jaar"
          note={state.bagData?.oppervlakte ? `Geschat o.b.v. ${state.bagData.oppervlakte}m²` : undefined} />
        <SliderInput label="Dakoppervlak" value={dakOpp} onChange={setDakOpp} min={10} max={dakMax} step={1} unit="m²"
          note={state.bagData?.dakOppervlakte ? `BAG: ${state.bagData.dakOppervlakte}m²` : undefined} />
        <SliderInput label="Zonnepanelen" value={panelen} onChange={setPanelen} min={1} max={panelenMax} step={1} unit="stuks"
          note="Pas aan als u al weet hoeveel panelen u wilt" />
      </div>

      {roiError && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-700 rounded-lg px-3 py-2">
          <span className="text-red-400 text-xs mt-0.5">!</span>
          <p className="text-red-400 text-xs font-mono">{roiError}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
          <div className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
          Herberekenen...
        </div>
      )}

      {roi && (
        <>
          <div>
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">Scenario Vergelijking</div>
            <div className="space-y-4">
              <ScenarioCard scenario={roi.scenarioNu} variant="amber" />
              <ScenarioCard scenario={roi.scenarioMetBatterij} variant="emerald" recommended />
              <ScenarioCard scenario={roi.scenarioWachten} variant="red" />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">2027 Urgentie</div>
            <Shock2027Banner shock={roi.shockEffect2027} besparingNu={roi.scenarioNu.besparingJaarEur} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Panelen', value: roi.aantalPanelen, unit: 'stuks' },
              { label: 'Productie', value: roi.productieKwh.toLocaleString('nl-NL'), unit: 'kWh/jaar' },
              { label: 'Eigengebruik', value: `${roi.eigenGebruikPct}%`, unit: 'van prod.' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-900/40 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-[10px] font-mono text-white/40 mb-1">{s.label}</div>
                <div className="font-mono font-bold text-amber-400">{s.value}</div>
                <div className="text-[10px] font-mono text-white/30">{s.unit}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {!state.bagData && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3">
          <p className="text-xs font-mono text-amber-300">Ga terug naar stap 1 om een adres op te zoeken</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => dispatch({ type: 'SET_STEP', step: 1 })}
          className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-mono text-sm py-3 px-4 rounded-full transition-colors">← Terug</button>
        <button onClick={() => dispatch({ type: 'SET_STEP', step: 3 })} disabled={!roi}
          className={`flex-[2] font-mono text-sm py-3 px-6 ${amberBtnCls}`}>
          Meterkast scannen →
        </button>
      </div>
    </div>
  )
}
