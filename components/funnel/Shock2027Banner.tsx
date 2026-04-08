'use client'

import type { ShockEffect2027 } from './types'

interface Shock2027BannerProps {
  shock: ShockEffect2027
  besparingNu: number
}

export function Shock2027Banner({ shock, besparingNu }: Shock2027BannerProps) {
  return (
    <div className="rounded-lg border-l-4 border-l-red-500 border border-red-800 bg-red-950/60 p-4 space-y-3">
      {/* Top row: comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Besparing Nu (2026)</div>
          <div className="font-mono font-bold text-amber-400 text-xl">
            €{besparingNu.toLocaleString('nl-NL')}<span className="text-xs text-slate-400">/jaar</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">Saldering: 28%</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Verlies Vanaf 2027</div>
          <div className="font-mono font-bold text-red-400 text-xl">
            -€{shock.jaarlijksVerlies.toLocaleString('nl-NL')}<span className="text-xs text-slate-400">/jaar</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 mt-0.5">Saldering: 0%</div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-red-800" />

      {/* Cumulative loss */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-slate-400">Cumulatief verlies over 5 jaar:</span>
        <span className="font-mono font-bold text-amber-400">
          €{shock.cumulatiefVerlies5Jaar.toLocaleString('nl-NL')}
        </span>
      </div>

      {/* Urgency line */}
      <div className="flex items-start gap-2 bg-red-900/40 rounded-md px-3 py-2">
        <span className="text-red-400 text-sm mt-0.5 shrink-0">!</span>
        <p className="text-sm font-mono text-red-300">
          Elke maand wachten kost u{' '}
          <span className="text-amber-400 font-bold">€{shock.maandelijksVerlies.toLocaleString('nl-NL')}</span>{' '}
          extra
        </p>
      </div>
    </div>
  )
}
