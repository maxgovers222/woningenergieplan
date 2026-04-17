'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const G = '#00aa65'

const amberBtnCls = [
  'bg-amber-500 text-slate-950 font-bold rounded-full',
  'transition-all duration-300',
  'shadow-[0_0_25px_rgba(245,158,11,0.4)]',
  'hover:opacity-90 active:scale-105',
  'disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100',
].join(' ')

interface Suggestion {
  label: string
  id: string
}

interface Props {
  extraParams?: Record<string, string>
  placeholder?: string
}

export function AddressAutocomplete({ extraParams, placeholder }: Props = {}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<Suggestion | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/bag/suggest?q=${encodeURIComponent(q)}`)
      const data: Suggestion[] = await res.json()
      setSuggestions(data)
      setOpen(data.length > 0)
      setActiveIdx(-1)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    setSelected(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 280)
  }

  function handleSelect(s: Suggestion) {
    setQuery(s.label)
    setSelected(s)
    setSuggestions([])
    setOpen(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const params = new URLSearchParams({ adres: selected.label, ...extraParams })
    router.push(`/check?${params.toString()}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(suggestions[activeIdx]) }
    if (e.key === 'Escape') { setOpen(false) }
  }

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-8">
      <div className="relative flex-1" ref={containerRef}>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? 'Uw adres, bijv. Keizersgracht 1, Amsterdam'}
          className="w-full rounded-full px-6 py-4 text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none shadow-xl"
          style={{ background: 'rgba(255,255,255,0.95)' }}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          </div>
        )}

        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
            role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={s.id}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={() => handleSelect(s)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`px-5 py-3 text-sm cursor-pointer flex items-center gap-3 transition-colors ${
                  i === activeIdx ? 'bg-slate-50 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                }`}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0" style={{ color: G }}>
                  <circle cx="7" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 13C7 13 2 9 2 5.5a5 5 0 0110 0C12 9 7 13 7 13z" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                <span className="truncate">{s.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={!selected}
        className={`py-4 px-7 text-sm whitespace-nowrap ${amberBtnCls}`}>
        Start gratis analyse
      </button>
    </form>
  )
}
