'use client'

import { useState, useEffect, useRef, type Dispatch } from 'react'
import type { FunnelState, FunnelAction, ROIResult } from './types'
import { Shock2027Banner } from './Shock2027Banner'

interface Step2ROIProps {
  state: FunnelState
  dispatch: Dispatch<FunnelAction>
}

function ScenarioCard({
  scenario,
  variant,
}: {
  scenario: { naam: string; beschrijving: string; besparingJaarEur: number; investeringEur: number; terugverdientijdJaar: number }
  variant: 'amber' | 'emerald' | 'red'
}) {
  const borderClass = variant === 'amber' ? 'border-amber-500' : variant === 'emerald' ? 'border-emerald-500' : 'border-red-700'
  const labelClass = variant === 'amber' ? 'text-amber-400' : variant === 'emerald' ? 'text-emerald-400' : 'text-red-400'
  const mutedClass = variant === 'red' ? 'opacity-60' : ''

  return (
    <div className={`bg-slate-900/60 border ${borderClass} rounded-lg p-4 ${mutedClass}`}>
      <div className={`text-[10px] font-mono uppercase tracking-widest mb-1 ${labelClass}`}>{scenario.naam}</div>
      <p className="text-xs text-slate-500 mb-3 font-mono">{scenario.beschrijving}</p>
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-slate-500 font-mono">Besparing/jaar</span>
          <span className={`font-mono font-bold text-lg ${labelClass}`}>€{scenario.besparingJaarEur.toLocaleString('nl-NL')}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-slate-500 font-mono">Investering</span>
          <span className="font-mono text-slate-300 text-sm">€{scenario.investeringEur.toLocaleString('nl-NL')}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-slate-500 font-mono">Terugverdientijd</span>
          <span className="font-mono text-slate-300 text-sm">
            {scenario.terugverdientijdJaar >= 99 ? '—' : `${scenario.terugverdientijdJaar} jaar`}
          </span>
        </div>
      </div>
      {variant === 'red' && (
        <div className="mt-3 pt-3 border-t border-red-900">
          <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">Saldering vervalt 1 jan 2027</span>
        </div>
      )}
    </div>
  )
}

function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  note,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
  unit: string
  note?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-mono text-slate-400 uppercase tracking-widest">{label}</label>
        <span className="font-mono font-bold text-amber-400 text-sm">
          {value.toLocaleString('nl-NL')} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-amber-500
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-amber-400
          accent-amber-500"
      />
      <div className="flex justify-between text-[10px] font-mono text-slate-600">
        <span>{min.toLocaleString('nl-NL')} {unit}</span>
        {note && <span className="text-slate-600 italic">{note}</span>}
        <span>{max.toLocaleString('nl-NL')} {unit}</span>
      </div>
    </div>
  )
}

export function Step2ROI({ state, dispatch }: Step2ROIProps) {
  const [verbruik, setVerbruik] = useState<number>(
    state.roiResult?.geschatVerbruikKwh ?? 3500
  )
  const [dakOpp, setDakOpp] = useState<number>(
    state.bagData?.dakOppervlakte ?? 35
  )
  const [localRoi, setLocalRoi] = useState<ROIResult | null>(state.roiResult ?? null)
  const [loading, setLoading] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch ROI whenever sliders change
  useEffect(() => {
    if (!state.bagData?.oppervlakte || !state.bagData?.bouwjaar) return

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/roi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oppervlakte: state.bagData!.oppervlakte,
            bouwjaar: state.bagData!.bouwjaar,
            dakOppervlakte: dakOpp,
            huidigVerbruikKwh: verbruik,
            netcongestieStatus: state.netcongestie?.status,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setLocalRoi(data.roi)
          dispatch({ type: 'SET_ROI', roiResult: data.roi })
          if (data.health) {
            dispatch({ type: 'SET_HEALTH_SCORE', healthScore: data.health })
          }
        }
      } catch {
        // silently fail — keep showing last result
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verbruik, dakOpp])

  const roi = localRoi

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] font-mono text-amber-400 tracking-widest uppercase mb-1">// STAP 02 — ROI BEREKENING</p>
        <h2 className="text-xl font-bold text-slate-100">Uw besparingsanalyse</h2>
        <p className="text-sm text-slate-400 mt-0.5">Pas de sliders aan voor een persoonlijke berekening</p>
      </div>

      {/* Sliders */}
      <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 space-y-5">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Parameters</div>
        <SliderInput
          label="Huidig verbruik"
          value={verbruik}
          onChange={setVerbruik}
          min={1000}
          max={8000}
          step={100}
          unit="kWh/jaar"
          note={state.bagData?.oppervlakte ? `Geschat o.b.v. ${state.bagData.oppervlakte}m²` : undefined}
        />
        <SliderInput
          label="Dakoppervlak"
          value={dakOpp}
          onChange={setDakOpp}
          min={10}
          max={100}
          step={1}
          unit="m²"
          note={state.bagData?.dakOppervlakte ? `BAG: ${state.bagData.dakOppervlakte}m²` : undefined}
        />
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
          <div className="w-3 h-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
          Herberekenen...
        </div>
      )}

      {/* Scenario cards */}
      {roi && (
        <>
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Scenario Vergelijking</div>
            <div className="space-y-3">
              <ScenarioCard scenario={roi.scenarioNu} variant="amber" />
              <ScenarioCard scenario={roi.scenarioMetBatterij} variant="emerald" />
              <ScenarioCard scenario={roi.scenarioWachten} variant="red" />
            </div>
          </div>

          {/* Shock 2027 banner */}
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">2027 Urgentie</div>
            <Shock2027Banner shock={roi.shockEffect2027} besparingNu={roi.scenarioNu.besparingJaarEur} />
          </div>

          {/* Summary readout */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-center">
              <div className="text-[10px] font-mono text-slate-500 mb-1">Panelen</div>
              <div className="font-mono font-bold text-amber-400">{roi.aantalPanelen}</div>
              <div className="text-[10px] font-mono text-slate-600">stuks</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-center">
              <div className="text-[10px] font-mono text-slate-500 mb-1">Productie</div>
              <div className="font-mono font-bold text-amber-400">{roi.productieKwh.toLocaleString('nl-NL')}</div>
              <div className="text-[10px] font-mono text-slate-600">kWh/jaar</div>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 text-center">
              <div className="text-[10px] font-mono text-slate-500 mb-1">Eigengebruik</div>
              <div className="font-mono font-bold text-amber-400">{roi.eigenGebruikPct}%</div>
              <div className="text-[10px] font-mono text-slate-600">van prod.</div>
            </div>
          </div>
        </>
      )}

      {/* No bag data warning */}
      {!state.bagData && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3">
          <p className="text-xs font-mono text-amber-300">Ga terug naar stap 1 om een adres op te zoeken</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={() => dispatch({ type: 'SET_STEP', step: 1 })}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono text-sm py-3 px-4 rounded-lg transition-colors"
        >
          ← Terug
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_STEP', step: 3 })}
          disabled={!roi}
          className="flex-[2] bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-bold py-3 px-6 rounded-lg transition-colors font-mono text-sm"
        >
          Meterkast scannen →
        </button>
      </div>
    </div>
  )
}
