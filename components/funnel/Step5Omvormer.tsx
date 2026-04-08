'use client'

import { type Dispatch } from 'react'
import type { FunnelState, FunnelAction, OmvormerAnalyse } from './types'
import { PhotoUpload } from './PhotoUpload'

interface Step5OmvormerProps {
  state: FunnelState
  dispatch: Dispatch<FunnelAction>
}

function OmvormerResultaat({ analyse }: { analyse: OmvormerAnalyse }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 bg-emerald-400 rounded-full" />
        <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Analyse compleet</span>
      </div>

      {/* Merk + model */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-md p-3">
          <div className="text-[10px] font-mono text-slate-500 mb-1">Merk</div>
          <div className="font-mono text-amber-400 font-semibold text-sm">{analyse.merk ?? 'Onbekend'}</div>
        </div>
        <div className="bg-slate-800 rounded-md p-3">
          <div className="text-[10px] font-mono text-slate-500 mb-1">Model</div>
          <div className="font-mono text-amber-400 font-semibold text-sm truncate">{analyse.model ?? '—'}</div>
        </div>
        <div className="bg-slate-800 rounded-md p-3">
          <div className="text-[10px] font-mono text-slate-500 mb-1">Vermogen</div>
          <div className="font-mono text-amber-400 font-semibold text-sm">
            {analyse.vermogenKw !== null ? `${analyse.vermogenKw} kW` : '—'}
          </div>
        </div>
        <div className="bg-slate-800 rounded-md p-3">
          <div className="text-[10px] font-mono text-slate-500 mb-1">Hybride klaar</div>
          <div className={`font-mono font-semibold text-sm ${analyse.hybrideKlaar ? 'text-emerald-400' : 'text-slate-400'}`}>
            {analyse.hybrideKlaar ? 'Ja ✓' : 'Nee'}
          </div>
        </div>
      </div>

      {/* Vervangen nodig warning */}
      {analyse.vervangenNodig && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-red-400 text-lg shrink-0">!</span>
          <div>
            <div className="font-mono font-bold text-red-400 text-sm">Vervanging aanbevolen</div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Omvormer is verouderd of niet compatibel met hybride systemen
            </div>
          </div>
        </div>
      )}

      {/* Hybride niet klaar info */}
      {!analyse.hybrideKlaar && !analyse.vervangenNodig && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg px-4 py-3">
          <div className="text-xs font-mono text-amber-300">
            <span className="text-amber-400 font-bold">Let op:</span> Niet hybride — extra omvormer of vervanging nodig voor batterij
          </div>
        </div>
      )}

      {/* Opmerkingen */}
      {analyse.opmerkingen.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">Opmerkingen</div>
          <ul className="space-y-1">
            {analyse.opmerkingen.map((opmerking, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs font-mono text-slate-400">
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

export function Step5Omvormer({ state, dispatch }: Step5OmvormerProps) {
  const analyse = state.omvormerAnalyse

  function handleAnalysed(result: OmvormerAnalyse) {
    dispatch({ type: 'SET_OMVORMER', omvormerAnalyse: result })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] font-mono text-amber-400 tracking-widest uppercase mb-1">// STAP 05 — OMVORMER SCAN</p>
        <h2 className="text-xl font-bold text-slate-100">Omvormer compatibiliteit</h2>
        <p className="text-sm text-slate-400 mt-0.5">AI-identificatie van merk, model en hybride geschiktheid</p>
      </div>

      {/* Upload or results */}
      {!analyse ? (
        <PhotoUpload
          visionType="omvormer"
          onAnalysed={(r) => handleAnalysed(r as OmvormerAnalyse)}
          title="Foto van uw omvormer"
          description="Maak een foto van het label/sticker op de omvormer. Zorg dat merk en model leesbaar zijn."
          icon="🔌"
        />
      ) : (
        <div className="space-y-3">
          <OmvormerResultaat analyse={analyse} />
          <button
            onClick={() => dispatch({ type: 'SET_OMVORMER', omvormerAnalyse: null as unknown as OmvormerAnalyse })}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono text-xs py-2 px-4 rounded-lg transition-colors"
          >
            Andere foto uploaden
          </button>
        </div>
      )}

      {/* No omvormer info */}
      {!analyse && (
        <div className="text-xs font-mono text-slate-600 text-center">
          Nog geen zonnepanelen? U kunt deze stap overslaan.
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={() => dispatch({ type: 'SET_STEP', step: 4 })}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono text-sm py-3 px-4 rounded-lg transition-colors"
        >
          ← Terug
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_STEP', step: 6 })}
          className="flex-[2] bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 px-6 rounded-lg transition-colors font-mono text-sm"
        >
          {analyse ? 'Aanvraag versturen →' : 'Overslaan →'}
        </button>
      </div>
    </div>
  )
}
