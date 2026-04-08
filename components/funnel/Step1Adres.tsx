'use client'

import { useState, type Dispatch } from 'react'
import type { FunnelState, FunnelAction } from './types'

interface Step1AdresProps {
  state: FunnelState
  dispatch: Dispatch<FunnelAction>
}

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
    ROOD: {
      label: 'Vol stroomnet — batterij prioriteit',
      textClass: 'text-red-400',
      bgClass: 'bg-red-900/40 border-red-700',
      dotClass: 'bg-red-400',
    },
    ORANJE: {
      label: 'Druk stroomnet',
      textClass: 'text-amber-400',
      bgClass: 'bg-amber-900/40 border-amber-700',
      dotClass: 'bg-amber-400',
    },
    GROEN: {
      label: 'Vrij stroomnet',
      textClass: 'text-emerald-400',
      bgClass: 'bg-emerald-900/40 border-emerald-700',
      dotClass: 'bg-emerald-400',
    },
  }

  const c = config[status]
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${c.bgClass}`}>
      <span className={`w-2 h-2 rounded-full ${c.dotClass} shrink-0`} />
      <div>
        <span className={`text-xs font-mono font-semibold ${c.textClass}`}>{status}</span>
        <span className="text-xs text-slate-400 ml-1.5">{c.label}</span>
        {netbeheerder && (
          <div className="text-xs text-slate-500 font-mono">{netbeheerder}</div>
        )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-slate-700 rounded w-3/4" />
      <div className="h-4 bg-slate-700 rounded w-1/2" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 bg-slate-700 rounded" />
        <div className="h-16 bg-slate-700 rounded" />
        <div className="h-16 bg-slate-700 rounded" />
        <div className="h-16 bg-slate-700 rounded" />
      </div>
      <div className="h-1 bg-amber-500/30 rounded overflow-hidden">
        <div className="h-full bg-amber-500 animate-[scan_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
      </div>
    </div>
  )
}

function DataCard({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">{label}</div>
      <div className="font-mono font-bold text-amber-400 text-lg leading-none">
        {value !== null && value !== undefined ? (
          <>
            {value}
            {unit && <span className="text-xs text-slate-400 ml-1">{unit}</span>}
          </>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </div>
    </div>
  )
}

export function Step1Adres({ state, dispatch }: Step1AdresProps) {
  const [inputValue, setInputValue] = useState(state.adres || '')
  const [localLoading, setLocalLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const hasResults = state.bagData !== null

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!inputValue.trim() || inputValue.trim().length < 5) {
      setLocalError('Voer een volledig adres in (minimaal 5 tekens)')
      return
    }
    setLocalLoading(true)
    setLocalError(null)

    try {
      // Fetch BAG data
      const bagRes = await fetch(`/api/bag?adres=${encodeURIComponent(inputValue.trim())}`)
      if (!bagRes.ok) {
        const errData = await bagRes.json().catch(() => ({}))
        throw new Error((errData as { error?: string }).error || 'Adres niet gevonden in BAG')
      }
      const bagData = await bagRes.json()

      dispatch({ type: 'SET_ADRES', adres: inputValue.trim() })
      dispatch({
        type: 'SET_BAG_DATA',
        bagData: {
          bouwjaar: bagData.bouwjaar,
          oppervlakte: bagData.oppervlakte,
          woningtype: bagData.woningtype,
          postcode: bagData.postcode,
          dakOppervlakte: bagData.dakOppervlakte,
          lat: bagData.lat,
          lon: bagData.lon,
        },
      })

      // Fetch netcongestie & ROI in parallel (if postcode available)
      const postcode = bagData.postcode
      const promises: Promise<void>[] = []

      if (postcode) {
        promises.push(
          fetch(`/api/netcongestie?postcode=${encodeURIComponent(postcode)}`)
            .then(async (r) => {
              if (r.ok) {
                const nc = await r.json()
                dispatch({ type: 'SET_NETCONGESTIE', netcongestie: nc })

                // Once we have netcongestie, compute ROI + health
                if (bagData.oppervlakte && bagData.bouwjaar && bagData.dakOppervlakte) {
                  const roiRes = await fetch('/api/roi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      oppervlakte: bagData.oppervlakte,
                      bouwjaar: bagData.bouwjaar,
                      dakOppervlakte: bagData.dakOppervlakte,
                      netcongestieStatus: nc.status,
                    }),
                  })
                  if (roiRes.ok) {
                    const roiData = await roiRes.json()
                    dispatch({ type: 'SET_ROI', roiResult: roiData.roi })
                    dispatch({ type: 'SET_HEALTH_SCORE', healthScore: roiData.health })
                  }
                }
              }
            })
            .catch(() => {
              // netcongestie not critical, continue
            })
        )
      } else if (bagData.oppervlakte && bagData.bouwjaar && bagData.dakOppervlakte) {
        promises.push(
          fetch('/api/roi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              oppervlakte: bagData.oppervlakte,
              bouwjaar: bagData.bouwjaar,
              dakOppervlakte: bagData.dakOppervlakte,
            }),
          })
            .then(async (r) => {
              if (r.ok) {
                const roiData = await r.json()
                dispatch({ type: 'SET_ROI', roiResult: roiData.roi })
                dispatch({ type: 'SET_HEALTH_SCORE', healthScore: roiData.health })
              }
            })
            .catch(() => {})
        )
      }

      await Promise.all(promises)
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Onbekende fout bij ophalen adresgegevens')
    } finally {
      setLocalLoading(false)
    }
  }

  function handleNext() {
    dispatch({ type: 'SET_STEP', step: 2 })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] font-mono text-amber-400 tracking-widest uppercase mb-1">// STAP 01 — ADRESVERIFICATIE</p>
        <h2 className="text-xl font-bold text-slate-100">Voer uw adres in</h2>
        <p className="text-sm text-slate-400 mt-0.5">Wij analyseren uw woning via het Kadaster BAG register</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Bijv. Prinsengracht 123, Amsterdam"
            className="w-full bg-slate-900 border border-slate-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-600 font-mono text-sm transition-colors"
            disabled={localLoading}
            autoComplete="street-address"
          />
          {localLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {localError && (
          <div className="flex items-start gap-2 bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
            <span className="text-red-400 text-xs mt-0.5">!</span>
            <p className="text-red-300 text-xs font-mono">{localError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={localLoading || inputValue.trim().length < 5}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-bold py-3 px-6 rounded-lg transition-colors font-mono text-sm"
        >
          {localLoading ? 'Analyseren...' : 'Adres Analyseren'}
        </button>
      </form>

      {/* Loading skeleton */}
      {localLoading && (
        <div className="pt-2">
          <LoadingSkeleton />
        </div>
      )}

      {/* Results */}
      {hasResults && !localLoading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-700" />
            <span className="text-[10px] font-mono text-slate-500 tracking-widest uppercase">Scan Resultaat</span>
            <div className="h-px flex-1 bg-slate-700" />
          </div>

          {/* Address confirmation */}
          <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Geanalyseerd adres</div>
            <div className="font-mono text-slate-100 text-sm">{state.adres}</div>
            {state.bagData?.postcode && (
              <div className="font-mono text-slate-400 text-xs mt-0.5">{state.bagData.postcode}</div>
            )}
          </div>

          {/* Data grid */}
          <div className="grid grid-cols-2 gap-3">
            <DataCard label="Bouwjaar" value={state.bagData?.bouwjaar ?? null} />
            <DataCard label="Oppervlakte" value={state.bagData?.oppervlakte ?? null} unit="m²" />
            <DataCard label="Woningtype" value={state.bagData?.woningtype ?? null} />
            <DataCard label="Dakoppervlak" value={state.bagData?.dakOppervlakte ?? null} unit="m²" />
          </div>

          {/* Netcongestie */}
          {state.netcongestie && (
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Netcongestie</div>
              <NetcongentieBadge status={state.netcongestie.status} netbeheerder={state.netcongestie.netbeheerder} />
            </div>
          )}

          {/* Health Score */}
          {state.healthScore && (
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Energiepotentieel Score</div>
              <div className="flex items-center justify-between">
                <HealthScoreGauge score={state.healthScore.score} label={state.healthScore.label} />
                <div className="flex-1 ml-4 space-y-1">
                  {state.healthScore.aanbevelingen.slice(0, 2).map((a, i) => (
                    <p key={i} className="text-xs text-slate-400 font-mono leading-relaxed">
                      <span className="text-amber-500 mr-1">›</span>{a}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Next step */}
          <button
            onClick={handleNext}
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 px-6 rounded-lg transition-colors font-mono text-sm flex items-center justify-center gap-2"
          >
            Bekijk besparingsanalyse
            <span>→</span>
          </button>
        </div>
      )}
    </div>
  )
}
