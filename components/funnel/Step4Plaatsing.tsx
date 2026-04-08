'use client'

import { type Dispatch } from 'react'
import type { FunnelState, FunnelAction, PlaatsingsAnalyse } from './types'
import { PhotoUpload } from './PhotoUpload'

interface Step4PlaatsingProps {
  state: FunnelState
  dispatch: Dispatch<FunnelAction>
}

function PlaatsingResultaat({ analyse }: { analyse: PlaatsingsAnalyse }) {
  const scoreColor =
    analyse.geschiktheidScore >= 8 ? 'text-emerald-400' :
    analyse.geschiktheidScore >= 5 ? 'text-amber-400' :
    'text-red-400'

  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 bg-emerald-400 rounded-full" />
        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Analyse compleet</span>
      </div>

      {/* NEN badge + score */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 ${analyse.nenCompliant ? 'bg-emerald-900/30 border-emerald-700' : 'bg-red-900/30 border-red-700'}`}>
          <span className={`font-mono font-bold text-sm ${analyse.nenCompliant ? 'text-emerald-400' : 'text-red-400'}`}>
            {analyse.nenCompliant ? 'NEN Compliant ✓' : 'NEN Non-compliant ✗'}
          </span>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 text-center min-w-20">
          <div className="text-[10px] font-mono text-slate-500 mb-1">Score</div>
          <div className={`font-mono font-bold text-xl ${scoreColor}`}>{analyse.geschiktheidScore}/10</div>
        </div>
      </div>

      {/* Risico items */}
      {analyse.risicoItems.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-red-400 uppercase tracking-widest mb-2">Risico items</div>
          <ul className="space-y-1">
            {analyse.risicoItems.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs font-mono text-red-300">
                <span className="text-red-500 shrink-0 mt-0.5">!</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Aanbevelingen */}
      {analyse.aanbevelingen.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-2">Aanbevelingen</div>
          <ul className="space-y-1">
            {analyse.aanbevelingen.map((aanbeveling, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs font-mono text-slate-400">
                <span className="text-amber-500 shrink-0 mt-0.5">›</span>
                {aanbeveling}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function Step4Plaatsing({ state, dispatch }: Step4PlaatsingProps) {
  const analyse = state.plaatsingsAnalyse

  function handleAnalysed(result: PlaatsingsAnalyse) {
    dispatch({ type: 'SET_PLAATSING', plaatsingsAnalyse: result })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] font-mono text-amber-400 tracking-widest uppercase mb-1">// STAP 04 — PLAATSINGSLOCATIE</p>
        <h2 className="text-xl font-bold text-slate-100">Locatie beoordeling</h2>
        <p className="text-sm text-slate-400 mt-0.5">NEN 2078:2023 brandveiligheidscheck voor batterijplaatsing</p>
      </div>

      {/* NEN info */}
      <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-3">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">NEN 2078:2023 vereisten</div>
        <ul className="space-y-1">
          {['Min. 50 cm afstand tot brandbare materialen', 'Adequate ventilatie aanwezig', 'Geen waterleiding of gas in nabijheid', 'Stabiele temperatuur (geen directe zon)'].map((req, i) => (
            <li key={i} className="text-xs font-mono text-slate-500 flex items-center gap-1.5">
              <span className="text-slate-600">○</span> {req}
            </li>
          ))}
        </ul>
      </div>

      {/* Upload or results */}
      {!analyse ? (
        <PhotoUpload
          visionType="plaatsingslocatie"
          onAnalysed={(r) => handleAnalysed(r as PlaatsingsAnalyse)}
          title="Foto van plaatsingslocatie"
          description="Foto van de ruimte waar de batterij of omvormer geplaatst wordt (garage, meterkast, bijkeuken)"
          icon="🔍"
        />
      ) : (
        <div className="space-y-3">
          <PlaatsingResultaat analyse={analyse} />
          <button
            onClick={() => dispatch({ type: 'SET_PLAATSING', plaatsingsAnalyse: null as unknown as PlaatsingsAnalyse })}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono text-xs py-2 px-4 rounded-lg transition-colors"
          >
            Andere foto uploaden
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={() => dispatch({ type: 'SET_STEP', step: 3 })}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono text-sm py-3 px-4 rounded-lg transition-colors"
        >
          ← Terug
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_STEP', step: 5 })}
          className="flex-[2] bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 px-6 rounded-lg transition-colors font-mono text-sm"
        >
          {analyse ? 'Omvormer scannen →' : 'Overslaan →'}
        </button>
      </div>
    </div>
  )
}
