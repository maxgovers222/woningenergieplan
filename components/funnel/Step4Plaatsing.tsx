'use client'

import { type Dispatch } from 'react'
import type { FunnelState, FunnelAction, PlaatsingsAnalyse } from './types'
import { PhotoUpload } from './PhotoUpload'
import { StepHeader } from './StepHeader'

interface Step4PlaatsingProps {
  state: FunnelState
  dispatch: Dispatch<FunnelAction>
}

const amberBtnCls = 'bg-amber-500 text-slate-950 font-bold rounded-full transition-all duration-300 shadow-[0_0_35px_rgba(245,158,11,0.5)] hover:opacity-90 active:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100'

function PlaatsingResultaat({ analyse }: { analyse: PlaatsingsAnalyse }) {
  const scoreColor = analyse.geschiktheidScore >= 8 ? 'text-emerald-400' : analyse.geschiktheidScore >= 5 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Analyse compleet</span>
      </div>
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 ${analyse.nenCompliant ? 'bg-emerald-950/30 border-emerald-700/50' : 'bg-red-950/40 border-red-700/50'}`}>
          <span className={`font-mono font-bold text-sm ${analyse.nenCompliant ? 'text-emerald-400' : 'text-red-400'}`}>
            {analyse.nenCompliant ? 'NEN Compliant ✓' : 'NEN Non-compliant ✗'}
          </span>
        </div>
        <div className="bg-slate-900/60 border border-white/10 rounded-lg p-3 text-center min-w-20">
          <div className="text-[10px] font-mono text-white/40 mb-1">Score</div>
          <div className={`font-mono font-bold text-xl ${scoreColor}`}>{analyse.geschiktheidScore}/10</div>
        </div>
      </div>
      {analyse.risicoItems.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-red-400 uppercase tracking-widest mb-2">Risico items</div>
          <ul className="space-y-1">
            {analyse.risicoItems.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs font-mono text-red-400">
                <span className="text-red-500 shrink-0 mt-0.5">!</span>{item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {analyse.aanbevelingen.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-2">Aanbevelingen</div>
          <ul className="space-y-1">
            {analyse.aanbevelingen.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs font-mono text-white/50">
                <span className="text-amber-400 shrink-0 mt-0.5">›</span>{a}
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
  return (
    <div className="p-6 space-y-6">
      <StepHeader stap="// STAP 04 — PLAATSINGSLOCATIE" title="Locatie beoordeling" subtitle="NEN 2078:2023 brandveiligheidscheck voor batterijplaatsing" />
      <div className="bg-slate-900/40 border border-white/10 rounded-xl p-3">
        <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1.5">NEN 2078:2023 vereisten</div>
        <ul className="space-y-1">
          {['Min. 50 cm afstand tot brandbare materialen', 'Adequate ventilatie aanwezig', 'Geen waterleiding of gas in nabijheid', 'Stabiele temperatuur (geen directe zon)'].map((req, i) => (
            <li key={i} className="text-xs font-mono text-white/40 flex items-center gap-1.5">
              <span className="text-white/10">○</span> {req}
            </li>
          ))}
        </ul>
      </div>
      {!analyse && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg px-4 py-3 flex items-start gap-2.5">
          <span className="text-amber-400 text-base shrink-0 mt-0.5">💡</span>
          <div className="text-xs font-mono text-amber-300 leading-relaxed">
            <span className="font-bold">Tip:</span> Maak een overzichtsfoto van de ruimte (garage, bijkeuken). Zorg dat ventilatie en nabijgelegen leidingen zichtbaar zijn.
          </div>
        </div>
      )}
      {!analyse ? (
        <PhotoUpload visionType="plaatsingslocatie" onAnalysed={(r) => dispatch({ type: 'SET_PLAATSING', plaatsingsAnalyse: r as PlaatsingsAnalyse })}
          title="Foto van plaatsingslocatie" description="Foto van de ruimte waar de batterij of omvormer geplaatst wordt (garage, meterkast, bijkeuken)" icon="🔍" />
      ) : (
        <div className="space-y-3">
          <PlaatsingResultaat analyse={analyse} />
          <button onClick={() => dispatch({ type: 'SET_PLAATSING', plaatsingsAnalyse: null as unknown as PlaatsingsAnalyse })}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-mono text-xs py-2 px-4 rounded-lg transition-colors">
            Andere foto uploaden
          </button>
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={() => dispatch({ type: 'SET_STEP', step: 3 })}
          className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-mono text-sm py-3 px-4 rounded-full transition-colors">← Terug</button>
        <button onClick={() => dispatch({ type: 'SET_STEP', step: 5 })}
          className={`flex-[2] font-mono text-sm py-3 px-6 ${amberBtnCls}`}>
          {analyse ? 'Omvormer scannen →' : 'Overslaan →'}
        </button>
      </div>
    </div>
  )
}
