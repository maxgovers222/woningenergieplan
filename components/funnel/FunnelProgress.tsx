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

const AMBER = '#f59e0b'
const AMBER_DARK = '#b45309'

export function FunnelProgress({ currentStep }: FunnelProgressProps) {
  return (
    <div className="w-full" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={6} aria-label={`Stap ${currentStep} van 6`}>
      <div className="h-1 rounded-full mb-4 overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="h-full transition-all duration-500 ease-out rounded-full"
          style={{ width: `${((currentStep - 1) / 5) * 100}%`, background: `linear-gradient(90deg, ${AMBER_DARK}, ${AMBER})` }}
        />
      </div>

      <div className="flex justify-between">
        {STEPS.map(({ label, num }) => {
          const isCompleted = num < currentStep
          const isActive = num === currentStep

          return (
            <div key={num} className="flex flex-col items-center gap-1.5">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={
                  isCompleted ? { background: AMBER, color: '#020617', boxShadow: `0 0 0 3px rgba(2,6,23,1), 0 0 0 5px ${AMBER}70, 0 0 12px ${AMBER}40` }
                  : isActive ? { background: AMBER, color: '#020617', boxShadow: `0 0 0 3px rgba(2,6,23,1), 0 0 0 5px ${AMBER}50, 0 0 20px ${AMBER}50` }
                  : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.12)' }
                }
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : <span>{num}</span>}
              </div>
              <span className="text-[10px] hidden sm:block transition-colors duration-300"
                style={{ fontFamily: 'var(--font-sans)', color: isActive ? AMBER : isCompleted ? AMBER : 'rgba(255,255,255,0.25)', fontWeight: isActive ? 600 : 400 }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-2 text-center sm:hidden">
        <span className="text-xs" style={{ color: AMBER, fontFamily: 'var(--font-sans)' }}>
          Stap {currentStep}/6 — {STEPS[currentStep - 1].label}
        </span>
      </div>
    </div>
  )
}
