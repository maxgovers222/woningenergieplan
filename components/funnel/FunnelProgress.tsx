'use client'

interface FunnelProgressProps {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6
}

const STEPS = [
  { label: 'Adres', num: 1 },
  { label: 'Besparing', num: 2 },
  { label: 'Meterkast', num: 3 },
  { label: 'Plaatsing', num: 4 },
  { label: 'Omvormer', num: 5 },
  { label: 'Aanvraag', num: 6 },
] as const

export function FunnelProgress({ currentStep }: FunnelProgressProps) {
  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="h-0.5 bg-slate-700 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-amber-500 transition-all duration-500 ease-out"
          style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex justify-between">
        {STEPS.map(({ label, num }) => {
          const isCompleted = num < currentStep
          const isActive = num === currentStep
          const isFuture = num > currentStep

          return (
            <div key={num} className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all duration-300',
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isActive
                    ? 'bg-amber-500 text-slate-900 ring-2 ring-amber-400/50 ring-offset-1 ring-offset-slate-900'
                    : 'bg-slate-600 text-slate-400',
                ].join(' ')}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span>{num}</span>
                )}
              </div>
              <span
                className={[
                  'text-[10px] font-mono hidden sm:block transition-colors duration-300',
                  isActive ? 'text-amber-400 font-semibold' : isCompleted ? 'text-emerald-400' : 'text-slate-500',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Mobile: active step label */}
      <div className="mt-2 text-center sm:hidden">
        <span className="text-xs font-mono text-amber-400">
          Stap {currentStep}/6 — {STEPS[currentStep - 1].label}
        </span>
      </div>
    </div>
  )
}
