interface StepHeaderProps {
  stap: string
  title: string
  subtitle: string
}

export function StepHeader({ stap, title, subtitle }: StepHeaderProps) {
  return (
    <div className="-mx-6 -mt-6 mb-6 px-6 pt-5 pb-5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <p className="text-xs font-medium mb-1.5" style={{ color: '#f59e0b', fontFamily: 'var(--font-sans)' }}>{stap}</p>
      <h2 className="text-xl font-extrabold text-white leading-tight" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>{title}</h2>
      <p className="text-sm mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-sans)' }}>{subtitle}</p>
    </div>
  )
}
