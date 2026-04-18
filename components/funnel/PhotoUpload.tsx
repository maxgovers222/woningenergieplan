'use client'

import { useState, useRef, useCallback } from 'react'
import type { MeterkastAnalyse, PlaatsingsAnalyse, OmvormerAnalyse } from './types'

type VisionType = 'meterkast' | 'plaatsingslocatie' | 'omvormer'
type VisionResult = MeterkastAnalyse | PlaatsingsAnalyse | OmvormerAnalyse

interface PhotoUploadProps {
  visionType: VisionType
  onAnalysed: (result: VisionResult) => void
  title: string
  description: string
}

function ScanAnimation({ imageUrl }: { imageUrl: string }) {
  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-amber-300/50 bg-slate-900">
      <img src={imageUrl} alt="Preview" className="w-full max-h-48 object-cover opacity-80" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-0 right-0 h-0.5 bg-amber-400/80 shadow-[0_0_8px_2px_rgba(245,158,11,0.6)]"
          style={{ animation: 'scan-line 1.5s linear infinite' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-amber-500/5" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
      </div>
      <div className="absolute bottom-2 left-2 right-2">
        <div className="bg-slate-900/80 rounded px-2 py-1 flex items-center gap-1.5">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest">Analyseren...</span>
        </div>
      </div>
    </div>
  )
}

export function PhotoUpload({ visionType, onAnalysed, title, description }: PhotoUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [screeningError, setScreeningError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Alleen afbeeldingen zijn toegestaan (JPEG, PNG, WebP)'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Afbeelding is te groot (max 10 MB)'); return }
    setError(null); setScreeningError(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setImageUrl(dataUrl)
      setLoading(true)
      try {
        const res = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: visionType, imageBase64: dataUrl }),
        })
        if (res.status === 422) {
          const errData = await res.json() as { tip?: string; detail?: string }
          setScreeningError(errData.tip ?? errData.detail ?? `Upload een duidelijke foto van een ${visionType}`)
          setLoading(false); return
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(errData.error ?? 'Vision analyse mislukt')
        }
        const data = await res.json() as { analyse: VisionResult }
        onAnalysed(data.analyse)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Onbekende fout bij analyse')
      } finally {
        setLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }, [visionType, onAnalysed])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleReset = () => { setImageUrl(null); setError(null); setScreeningError(null); setLoading(false) }

  if (loading && imageUrl) return <ScanAnimation imageUrl={imageUrl} />

  if (!imageUrl) {
    return (
      <div className="space-y-3">
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true) }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false) }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={[
            'relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-all duration-200',
            isDragOver ? 'border-amber-500 bg-amber-500/10 scale-[1.01]' : 'border-white/15 hover:border-amber-500/50 bg-white/5 hover:bg-amber-500/5',
          ].join(' ')}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-white/30">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div className="text-center">
            <p className="font-semibold text-white/80 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>{title}</p>
            <p className="text-xs text-white/40 mt-1" style={{ fontFamily: 'var(--font-sans)' }}>{description}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-px w-12 bg-white/10" />
            <span className="text-[10px] text-white/30" style={{ fontFamily: 'var(--font-sans)' }}>Sleep of klik</span>
            <div className="h-px w-12 bg-white/10" />
          </div>
          <div className="text-[10px] text-amber-600/70" style={{ fontFamily: 'var(--font-sans)' }}>JPEG · PNG · WebP — max 10 MB</div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }} className="hidden" />

        {error && (
          <div className="bg-red-950/40 border border-red-700 rounded-xl px-3 py-2">
            <p className="text-xs font-mono text-red-400">{error}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden border border-white/10">
        <img src={imageUrl} alt="Geüploade foto" className="w-full max-h-48 object-cover" />
        <button onClick={handleReset}
          className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-[10px] font-mono text-white/60 transition-colors">
          Andere foto
        </button>
      </div>

      {screeningError && (
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 text-sm shrink-0 mt-0.5">!</span>
            <p className="text-xs font-mono text-amber-300">{screeningError}</p>
          </div>
          <button onClick={handleReset}
            className="w-full bg-amber-950/50 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 font-mono text-xs py-2 px-3 rounded-md transition-colors">
            Opnieuw proberen
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-700 rounded-xl p-3 space-y-2">
          <p className="text-xs font-mono text-red-400">{error}</p>
          <button onClick={handleReset}
            className="w-full bg-red-950/60 hover:bg-red-950 border border-red-700/50 text-red-400 font-mono text-xs py-2 px-3 rounded-md transition-colors">
            Opnieuw proberen
          </button>
        </div>
      )}
    </div>
  )
}
