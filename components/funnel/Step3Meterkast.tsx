'use client'

import { type Dispatch } from 'react'
import type { FunnelState, FunnelAction, MeterkastAnalyse } from './types'
import { PhotoUpload } from './PhotoUpload'
import { StepHeader } from './StepHeader'

interface Step3MeterkastProps {
  state: FunnelState
  dispatch: Dispatch<FunnelAction>
}

const amberBtnCls = 'bg-amber-500 text-slate-950 font-bold rounded-full transition-all duration-300 shadow-[0_0_35px_rgba(245,158,11,0.5)] hover:opacity-90 active:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100'

function MeterkastResultaat({ analyse }: { analyse: MeterkastAnalyse }) {
  return (
    <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Analyse compleet</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Merk', value: analyse.merk ?? 'Onbekend', color: 'text-amber-400' },
          { label: '3-fase', value: analyse.drieFase ? 'Ja ✓' : 'Nee ✗', color: analyse.drieFase ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Vrije groepen', value: String(analyse.vrijeGroepen), color: 'text-amber-400' },
          { label: 'Max vermogen', value: analyse.maxVermogenKw !== null ? `${analyse.maxVermogenKw} kW` : '—', color: 'text-amber-400' },
        ].map((item) => (
          <div key={item.label} className="bg-slate-900/60 border border-white/10 rounded-md p-3">
            <div className="text-[10px] font-mono text-white/40 mb-1">{item.label}</div>
            <div className={`font-mono font-semibold text-sm ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>
      <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${analyse.geschikt ? 'bg-emerald-950/30 border border-emerald-700/50' : 'bg-red-950/40 border border-red-700/50'}`}>
        <span className="text-2xl">{analyse.geschikt ? '✓' : '✗'}</span>
        <div>
          <div className={`font-mono font-bold text-sm ${analyse.geschikt ? 'text-emerald-400' : 'text-red-400'}`}>
            {analyse.geschikt ? 'Geschikt voor installatie' : 'Niet direct geschikt'}
          </div>
          {!analyse.geschikt && <div className="text-xs text-white/40 font-mono mt-0.5">Installateur advies nodig</div>}
        </div>
      </div>
      {analyse.opmerkingen.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-2">Opmerkingen</div>
          <ul className="space-y-1">
            {analyse.opmerkingen.map((o, i) => (
              <li key={i} className="text-xs font-mono text-white/50 flex items-start gap-1.5">
                <span className="text-amber-400 shrink-0 mt-0.5">›</span>{o}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function Step3Meterkast({ state, dispatch }: Step3MeterkastProps) {
  const analyse = state.meterkastAnalyse
  return (
    <div className="p-6 space-y-6">
      <StepHeader stap="// STAP 03 — METERKAST SCAN" title="Meterkast analyse" subtitle="AI-scan bepaalt geschiktheid voor zonnepanelen & batterij" />
      {!analyse && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg px-4 py-3 flex items-start gap-2.5">
          <span className="text-amber-400 text-base shrink-0 mt-0.5">💡</span>
          <div className="text-xs font-mono text-amber-300 leading-relaxed">
            <span className="font-bold">Tip:</span> Open de kast volledig, sta ~1 meter ervoor en zorg voor verlichting. Alle groepen moeten zichtbaar zijn.
          </div>
        </div>
      )}
      {!analyse ? (
        <PhotoUpload visionType="meterkast" onAnalysed={(r) => dispatch({ type: 'SET_METERKAST', meterkastAnalyse: r as MeterkastAnalyse })}
          title="Foto van uw meterkast" description="Maak een foto van de open meterkastkast, inclusief alle groepen zichtbaar" icon="⚡" />
      ) : (
        <div className="space-y-3">
          <MeterkastResultaat analyse={analyse} />
          <button onClick={() => dispatch({ type: 'SET_METERKAST', meterkastAnalyse: null as unknown as MeterkastAnalyse })}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-mono text-xs py-2 px-4 rounded-lg transition-colors">
            Andere foto uploaden
          </button>
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={() => dispatch({ type: 'SET_STEP', step: 2 })}
          className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 font-mono text-sm py-3 px-4 rounded-full transition-colors">← Terug</button>
        <button onClick={() => dispatch({ type: 'SET_STEP', step: 4 })}
          className={`flex-[2] font-mono text-sm py-3 px-6 ${amberBtnCls}`}>
          {analyse ? 'Plaatsing scannen →' : 'Overslaan →'}
        </button>
      </div>
    </div>
  )
}
