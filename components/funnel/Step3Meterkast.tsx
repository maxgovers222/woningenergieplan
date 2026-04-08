'use client'

import { type Dispatch } from 'react'
import type { FunnelState, FunnelAction, MeterkastAnalyse } from './types'
import { PhotoUpload } from './PhotoUpload'

interface Step3MeterkastProps {
  state: FunnelState
  dispatch: Dispatch<FunnelAction>
}

function MeterkastResultaat({ analyse }: { analyse: MeterkastAnalyse }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 bg-emerald-400 rounded-full" />
        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Analyse compleet</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-md p-3">
          <div className="text-[10px] font-mono text-slate-500 mb-1">Merk</div>
          <div className="font-mono text-amber-400 font-semibold text-sm">{analyse.merk ?? 'Onbekend'}</div>
        </div>
        <div className="bg-slate-800 rounded-md p-3">
          <div className="text-[10px] font-mono text-slate-500 mb-1">3-fase</div>
          <div className={`font-mono font-semibold text-sm ${analyse.drieFase ? 'text-emerald-400' : 'text-red-400'}`}>
            {analyse.drieFase ? 'Ja ✓' : 'Nee ✗'}
          </div>
        </div>
        <div className="bg-slate-800 rounded-md p-3">
          <div className="text-[10px] font-mono text-slate-500 mb-1">Vrije groepen</div>
          <div className="font-mono text-amber-400 font-semibold text-sm">{analyse.vrijeGroepen}</div>
        </div>
        <div className="bg-slate-800 rounded-md p-3">
          <div className="text-[10px] font-mono text-slate-500 mb-1">Max vermogen</div>
          <div className="font-mono text-amber-400 font-semibold text-sm">
            {analyse.maxVermogenKw !== null ? `${analyse.maxVermogenKw} kW` : '—'}
          </div>
        </div>
      </div>

      {/* Geschiktheid */}
      <div className={`flex items-center gap-3 rounded-lg px-4 py-3 ${analyse.geschikt ? 'bg-emerald-900/30 border border-emerald-700' : 'bg-red-900/30 border border-red-700'}`}>
        <span className="text-2xl">{analyse.geschikt ? '✓' : '✗'}</span>
        <div>
          <div className={`font-mono font-bold text-sm ${analyse.geschikt ? 'text-emerald-400' : 'text-red-400'}`}>
            {analyse.geschikt ? 'Geschikt voor installatie' : 'Niet direct geschikt'}
          </div>
          {!analyse.geschikt && (
            <div className="text-xs text-slate-400 font-mono mt-0.5">Installateur advies nodig</div>
          )}
        </div>
      </div>

      {/* Opmerkingen */}
      {analyse.opmerkingen.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Opmerkingen</div>
          <ul className="space-y-1">
            {analyse.opmerkingen.map((opmerking, i) => (
              <li key={i} className="text-xs font-mono text-slate-400 flex items-start gap-1.5">
                <span className="text-amber-500 shrink-0 mt-0.5">›</span>
                {opmerking}
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

  function handleAnalysed(result: MeterkastAnalyse) {
    dispatch({ type: 'SET_METERKAST', meterkastAnalyse: result })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] font-mono text-amber-400 tracking-widest uppercase mb-1">// STAP 03 — METERKAST SCAN</p>
        <h2 className="text-xl font-bold text-slate-100">Meterkast analyse</h2>
        <p className="text-sm text-slate-400 mt-0.5">AI-scan bepaalt geschiktheid voor zonnepanelen & batterij</p>
      </div>

      {/* Upload or results */}
      {!analyse ? (
        <PhotoUpload
          visionType="meterkast"
          onAnalysed={(r) => handleAnalysed(r as MeterkastAnalyse)}
          title="Foto van uw meterkast"
          description="Maak een foto van de open meterkastkast, inclusief alle groepen zichtbaar"
          icon="⚡"
        />
      ) : (
        <div className="space-y-3">
          <MeterkastResultaat analyse={analyse} />
          <button
            onClick={() => dispatch({ type: 'SET_METERKAST', meterkastAnalyse: null as unknown as MeterkastAnalyse })}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono text-xs py-2 px-4 rounded-lg transition-colors"
          >
            Andere foto uploaden
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={() => dispatch({ type: 'SET_STEP', step: 2 })}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono text-sm py-3 px-4 rounded-lg transition-colors"
        >
          ← Terug
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_STEP', step: 4 })}
          className="flex-[2] bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-bold py-3 px-6 rounded-lg transition-colors font-mono text-sm"
        >
          {analyse ? 'Plaatsing scannen →' : 'Overslaan →'}
        </button>
      </div>
    </div>
  )
}
