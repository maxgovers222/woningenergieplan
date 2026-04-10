'use client'

import { useState, useEffect, useRef, useCallback, type Dispatch } from 'react'
import type { FunnelState, FunnelAction } from './types'
import { StepHeader } from './StepHeader'
import { AnalysisLoading } from './AnalysisLoading'

interface Step1AdresProps {
  state: FunnelState
  dispatch: Dispatch<FunnelAction>
}

const amberBtnCls = 'bg-[#f59e0b] text-slate-950 font-bold rounded-full transition-all duration-200 shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100 disabled:brightness-100'

function HealthScoreGauge({ score, label }: { score: number; label: string }) {
  const colorClass =
    score >= 75 ? 'text-emerald-400' :
    score >= 55 ? 'text-amber-400' :
    score >= 35 ? 'text-orange-400' :
    'text-red-400'

  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-2xl font-mono font-bold ${colorClass}`}>{score}/100</span>
      <span className={`text-xs font-mono ${colorClass}`}>{label}</span>
    </div>
  )
}

function NetcongentieBadge({ status, netbeheerder }: { status: 'ROOD' | 'ORANJE' | 'GROEN'; netbeheerder: string }) {
  const config = {
    ROOD: { label: 'Vol stroomnet — batterij prioriteit', textClass: 'text-red-400', bgClass: 'bg-red-950/50 border-red-700', dotClass: 'bg-red-500' },
    ORANJE: { label: 'Druk stroomnet', textClass: 'text-amber-400', bgClass: 'bg-amber-950/50 border-amber-700', dotClass: 'bg-amber-500' },
    GROEN: { label: 'Vrij stroomnet', textClass: 'text-emerald-400', bgClass: 'bg-emerald-950/50 border-emerald-700', dotClass: 'bg-emerald-500' },
  }
  const c = config[status]
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${c.bgClass}`}>
      <span className={`w-2 h-2 rounded-full ${c.dotClass} shrink-0`} />
      <div>
        <span className={`text-xs font-mono font-semibold ${c.textClass}`}>{status}</span>
        <span className="text-xs text-white/40 ml-1.5">{c.label}</span>
        {netbeheerder && <div className="text-xs text-white/30 font-mono">{netbeheerder}</div>}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-3/4" />
      <div className="h-4 bg-white/10 rounded w-1/2" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-white/10 rounded" />)}
      </div>
    </div>
  )
}

function DataCard({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  return (
    <div className="bg-slate-900/40 border border-white/10 rounded-xl p-3">
      <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">{label}</div>
      <div className="font-mono font-bold text-amber-400 text-lg leading-none">
        {value !== null && value !== undefined ? (
          <>{value}{unit && <span className="text-xs text-white/30 ml-1">{unit}</span>}</>
        ) : <span className="text-white/20">—</span>}
      </div>
    </div>
  )
}

interface Suggestion { label: string; id: string }

function AddressAutocomplete({ value, onChange, onSelect, isSelected, disabled }: {
  value: string; onChange: (v: string) => void; onSelect: (label: string) => void
  isSelected: boolean; disabled: boolean
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/bag/suggest?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data: Suggestion[] = await res.json()
        setSuggestions(data)
        setOpen(data.length > 0)
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    onChange(v)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => fetchSuggestions(v), 250)
  }

  function handleSelect(s: Suggestion) {
    onSelect(s.label)
    setSuggestions([])
    setOpen(false)
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text" value={value} onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Bijv. Prinsengracht 123, Amsterdam"
          disabled={disabled} autoComplete="off"
          className={[
            'w-full bg-slate-950/60 border rounded-xl px-4 py-3.5 text-white placeholder:text-slate-500 font-mono text-sm transition-all focus:outline-none amber-glow',
            isSelected ? 'border-emerald-500/50' : 'border-white/10',
          ].join(' ')}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {loading && <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />}
          {isSelected && !loading && (
            <div className="w-4 h-4 bg-emerald-500/80 rounded-full flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-lg shadow-2xl overflow-hidden">
          {suggestions.map((s) => (
            <button key={s.id} type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
              className="w-full text-left px-4 py-2.5 text-sm font-mono text-white/70 hover:bg-amber-500/10 hover:text-amber-300 transition-colors border-b border-white/5 last:border-0">
              <span className="text-amber-500/60 mr-2 text-xs">📍</span>{s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Step1Adres({ state, dispatch }: Step1AdresProps) {
  const [inputValue, setInputValue] = useState(state.adres || '')
  const [selectedAdres, setSelectedAdres] = useState<string | null>(state.adres || null)
  const [localLoading, setLocalLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const hasResults = state.bagData !== null

  useEffect(() => {
    if (state.adres && state.adres.length >= 5 && !state.bagData) doSearch(state.adres)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function doSearch(adres: string) {
    setLocalLoading(true)
    setLocalError(null)
    try {
      const bagRes = await fetch(`/api/bag?adres=${encodeURIComponent(adres)}`)
      if (!bagRes.ok) {
        const errData = await bagRes.json().catch(() => ({}))
        throw new Error((errData as { error?: string }).error || 'Adres niet gevonden in BAG')
      }
      const bagData = await bagRes.json()
      dispatch({ type: 'SET_ADRES', adres })
      dispatch({ type: 'SET_BAG_DATA', bagData: {
        bouwjaar: bagData.bouwjaar, oppervlakte: bagData.oppervlakte,
        woningtype: bagData.woningtype, postcode: bagData.postcode,
        dakOppervlakte: bagData.dakOppervlakte, lat: bagData.lat, lon: bagData.lon,
      }})

      const promises: Promise<void>[] = []
      if (bagData.postcode) {
        promises.push(
          fetch(`/api/netcongestie?postcode=${encodeURIComponent(bagData.postcode)}`)
            .then(async (r) => {
              if (r.ok) {
                const nc = await r.json()
                dispatch({ type: 'SET_NETCONGESTIE', netcongestie: nc })
                if (bagData.oppervlakte && bagData.bouwjaar && bagData.dakOppervlakte) {
                  const roiRes = await fetch('/api/roi', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oppervlakte: bagData.oppervlakte, bouwjaar: bagData.bouwjaar, dakOppervlakte: bagData.dakOppervlakte, netcongestieStatus: nc.status }),
                  })
                  if (roiRes.ok) {
                    const roiData = await roiRes.json()
                    dispatch({ type: 'SET_ROI', roiResult: roiData.roi })
                    dispatch({ type: 'SET_HEALTH_SCORE', healthScore: roiData.health })
                  }
                }
              }
            }).catch(() => {})
        )
      } else if (bagData.oppervlakte && bagData.bouwjaar && bagData.dakOppervlakte) {
        promises.push(
          fetch('/api/roi', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oppervlakte: bagData.oppervlakte, bouwjaar: bagData.bouwjaar, dakOppervlakte: bagData.dakOppervlakte }),
          }).then(async (r) => {
            if (r.ok) { const d = await r.json(); dispatch({ type: 'SET_ROI', roiResult: d.roi }); dispatch({ type: 'SET_HEALTH_SCORE', healthScore: d.health }) }
          }).catch(() => {})
        )
      }
      await Promise.all(promises)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Onbekende fout bij ophalen adresgegevens')
    } finally {
      setLocalLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedAdres) return
    await doSearch(selectedAdres)
  }

  function handleInputChange(v: string) {
    setInputValue(v)
    if (selectedAdres && v !== selectedAdres) setSelectedAdres(null)
  }

  return (
    <div className="p-7 space-y-6">
      <StepHeader stap="// STAP 01 — ADRESVERIFICATIE" title="Voer uw adres in" subtitle="Selecteer uw adres voor een nauwkeurige BAG-analyse" />

      <form onSubmit={handleSubmit} className="space-y-3">
        <AddressAutocomplete
          value={inputValue} onChange={handleInputChange}
          onSelect={(label) => { setInputValue(label); setSelectedAdres(label); setLocalError(null) }}
          isSelected={!!selectedAdres} disabled={localLoading}
        />

        {!selectedAdres && inputValue.length >= 3 && (
          <p className="text-[10px] font-mono text-white/30">
            <span className="text-amber-500">›</span> Selecteer een adres uit de suggesties om door te gaan
          </p>
        )}

        {localError && (
          <div className="flex items-start gap-2 bg-red-950/40 border border-red-700 rounded-lg px-3 py-2">
            <span className="text-red-400 text-xs mt-0.5">!</span>
            <p className="text-red-400 text-xs font-mono">{localError}</p>
          </div>
        )}

        <button type="submit" disabled={!selectedAdres || localLoading}
          className={`w-full font-mono text-sm py-3 px-6 ${amberBtnCls}`}>
          {localLoading ? 'Analyseren...' : 'Adres Analyseren'}
        </button>
      </form>

      {localLoading && <AnalysisLoading wijk={state.wijk || undefined} />}

      {hasResults && !localLoading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">Scan Resultaat</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="bg-slate-900/40 border border-white/10 rounded-xl p-3">
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Geanalyseerd adres</div>
            <div className="font-mono text-white text-sm">{state.adres}</div>
            {state.bagData?.postcode && <div className="font-mono text-white/40 text-xs mt-0.5">{state.bagData.postcode}</div>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DataCard label="Bouwjaar" value={state.bagData?.bouwjaar ?? null} />
            <DataCard label="Oppervlakte" value={state.bagData?.oppervlakte ?? null} unit="m²" />
            <DataCard label="Woningtype" value={state.bagData?.woningtype ?? null} />
            <DataCard label="Dakoppervlak" value={state.bagData?.dakOppervlakte ?? null} unit="m²" />
          </div>

          {state.netcongestie && (
            <div>
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">Netcongestie</div>
              <NetcongentieBadge status={state.netcongestie.status} netbeheerder={state.netcongestie.netbeheerder} />
            </div>
          )}

          {state.healthScore && (
            <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4">
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">Energiepotentieel Score</div>
              <div className="flex items-center justify-between">
                <HealthScoreGauge score={state.healthScore.score} label={state.healthScore.label} />
                <div className="flex-1 ml-4 space-y-1">
                  {state.healthScore.aanbevelingen.slice(0, 2).map((a, i) => (
                    <p key={i} className="text-xs text-white/40 font-mono leading-relaxed">
                      <span className="text-amber-400 mr-1">›</span>{a}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button onClick={() => dispatch({ type: 'SET_STEP', step: 2 })}
            className={`w-full font-mono text-sm py-3 px-6 flex items-center justify-center gap-2 ${amberBtnCls}`}>
            Bekijk besparingsanalyse <span>→</span>
          </button>
        </div>
      )}
    </div>
  )
}
