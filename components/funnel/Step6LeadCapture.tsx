'use client'

import { useState, type Dispatch } from 'react'
import type { FunnelState, FunnelAction } from './types'
import { StepHeader } from './StepHeader'

function extractStad(adres: string): string {
  const parts = adres.split(/[,\s]+/)
  return parts[parts.length - 1] ?? adres
}

function extractProvincie(postcodePrefix: string): string | null {
  const num = parseInt(postcodePrefix)
  if (num >= 1000 && num <= 1999) return 'Noord-Holland'
  if (num >= 2000 && num <= 2999) return 'Zuid-Holland'
  if (num >= 3000 && num <= 3999) return 'Utrecht'
  if (num >= 4000 && num <= 4799) return 'Noord-Brabant'
  if (num >= 4800 && num <= 4999) return 'Zeeland'
  if (num >= 5000 && num <= 5999) return 'Noord-Brabant'
  if (num >= 6000 && num <= 6299) return 'Limburg'
  if (num >= 6300 && num <= 6999) return 'Gelderland'
  if (num >= 7000 && num <= 7999) return 'Overijssel'
  if (num >= 8000 && num <= 8999) return 'Friesland'
  if (num >= 9000 && num <= 9499) return 'Groningen'
  if (num >= 9500 && num <= 9699) return 'Drenthe'
  if (num >= 9700 && num <= 9999) return 'Groningen'
  return null
}

interface Step6LeadCaptureProps {
  state: FunnelState
  dispatch: Dispatch<FunnelAction>
}

interface LeadFormData {
  naam: string
  email: string
  telefoon: string
  gdprConsent: boolean
}

function IsdeSummaryCard({ bedragEur, apparaatType, vermogenKwp }: { bedragEur: number; apparaatType: string; vermogenKwp: number }) {
  if (bedragEur <= 0) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="text-[10px] font-mono text-amber-600 uppercase tracking-widest mb-2">ISDE Subsidie Schatting</div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono font-bold text-amber-600 text-2xl">€{bedragEur.toLocaleString('nl-NL')}</span>
        <span className="text-xs font-mono text-slate-400">via ISDE-regeling</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <div className="text-[10px] font-mono text-slate-400">Apparaat</div>
          <div className="text-sm font-mono text-slate-700">{apparaatType}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-slate-400">Vermogen</div>
          <div className="text-sm font-mono text-slate-700">{vermogenKwp} kWp</div>
        </div>
      </div>
    </div>
  )
}

function SuccessState() {
  return (
    <div className="text-center space-y-4 py-8">
      <div className="w-16 h-16 bg-emerald-50 border border-emerald-300 rounded-full flex items-center justify-center mx-auto">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M6 16l6 6L26 8" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <h3 className="text-xl font-bold text-[#0e352e]">Aanvraag ingediend!</h3>
        <p className="text-sm text-slate-500 mt-2 font-mono">
          Een gecertificeerde installateur neemt binnen 24 uur contact op.
        </p>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left space-y-2">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Volgende stappen</div>
        {[
          'Installateur bekijkt uw energiedossier',
          'U ontvangt een persoonlijke offerte',
          'Gratis inspectie op locatie',
          'ISDE subsidie aanvraag begeleiding',
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-mono text-slate-600">
            <span className="text-emerald-600 font-bold">{i + 1}.</span>
            {step}
          </div>
        ))}
      </div>
    </div>
  )
}

const inputBase = 'w-full bg-white border rounded-lg px-4 py-3 text-slate-800 placeholder:text-slate-400 font-mono text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500/50'

export function Step6LeadCapture({ state, dispatch }: Step6LeadCaptureProps) {
  const [form, setForm] = useState<LeadFormData>({ naam: '', email: '', telefoon: '', gdprConsent: false })
  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData | 'submit', string>>>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.naam.trim()) e.naam = 'Naam is verplicht'
    if (!form.email.trim()) e.email = 'E-mail is verplicht'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Voer een geldig e-mailadres in'
    if (!form.telefoon.trim()) e.telefoon = 'Telefoonnummer is verplicht'
    else if (form.telefoon.replace(/\s/g, '').length < 10) e.telefoon = 'Voer een geldig telefoonnummer in'
    if (!form.gdprConsent) e.gdprConsent = 'U moet akkoord gaan met de privacyverklaring om door te gaan.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setSubmitError(null)
    setErrors({})
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naam: form.naam, email: form.email, telefoon: form.telefoon,
          adres: state.adres, postcode: state.bagData?.postcode,
          stad: state.bagData ? extractStad(state.adres) : null,
          provincie: state.netcongestie?.postcodePrefix ? extractProvincie(state.netcongestie.postcodePrefix) : null,
          lat: state.bagData?.lat, lon: state.bagData?.lon, bagData: state.bagData,
          healthScore: state.healthScore?.score, netcongestieStatus: state.netcongestie?.status,
          roiResult: state.roiResult, meterkastAnalyse: state.meterkastAnalyse,
          plaatsingsAnalyse: state.plaatsingsAnalyse, omvormerAnalyse: state.omvormerAnalyse,
          isdeSchatting: state.roiResult?.isdeSchatting, gdprConsent: form.gdprConsent,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setErrors({ submit: (err as { error?: string }).error ?? 'Er is een fout opgetreden. Probeer opnieuw.' })
        return
      }
      const data = await res.json() as { leadId: string }
      dispatch({ type: 'SET_LEAD_ID', leadId: data.leadId })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Indienen mislukt. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return <div className="p-6"><SuccessState /></div>

  const isde = state.roiResult?.isdeSchatting
  const regio = state.wijk || (state.bagData ? state.adres.split(',').pop()?.trim() : null) || 'uw regio'

  return (
    <div className="p-6 space-y-6">
      <StepHeader stap="// STAP 06 — AANVRAAG" title="Persoonlijk 2027-Rapport" subtitle="Ontvang uw investeringsrapport van een gecertificeerde energie-expert" />

      {isde && <IsdeSummaryCard {...isde} />}

      {/* Floating report preview card */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
        <div className="text-[10px] font-mono text-amber-600 uppercase tracking-widest mb-3">📄 Persoonlijk Investeringsrapport 2027</div>
        <div className="space-y-1.5 mb-3">
          {[
            { label: 'ROI-berekening', value: state.roiResult ? `€${state.roiResult.scenarioNu.besparingJaarEur.toLocaleString('nl-NL')}/jaar` : '—', done: !!state.roiResult },
            { label: 'ISDE subsidie check', value: isde ? `€${isde.bedragEur.toLocaleString('nl-NL')}` : '—', done: !!isde },
            { label: 'Netcongestie analyse', value: state.netcongestie?.status ?? '—', done: !!state.netcongestie },
            { label: 'Installateur advies', value: 'Binnen 24 uur', done: true },
            { label: '2027 urgentie tijdlijn', value: 'Inbegrepen', done: true },
          ].map(({ label, value, done }) => (
            <div key={label} className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className={done ? 'text-emerald-500' : 'text-slate-300'}>✓</span>
                {label}
              </span>
              <span className="text-slate-700 font-semibold">{value}</span>
            </div>
          ))}
        </div>
        {state.adres && (
          <div className="pt-2 border-t border-slate-200">
            <div className="text-[10px] font-mono text-slate-400 mb-0.5">Adres</div>
            <div className="text-xs font-mono text-slate-600 truncate">{state.adres}</div>
          </div>
        )}
        {state.healthScore && (
          <div className="flex gap-4 mt-2">
            <div>
              <div className="text-[10px] font-mono text-slate-400">Score</div>
              <div className="text-sm font-mono font-bold text-amber-600">{state.healthScore.score}/100</div>
            </div>
            {state.roiResult && (
              <div>
                <div className="text-[10px] font-mono text-slate-400">Besparing/jaar</div>
                <div className="text-sm font-mono font-bold text-emerald-600">€{state.roiResult.scenarioNu.besparingJaarEur.toLocaleString('nl-NL')}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-3">Uw energiedossier</div>
        <div className="space-y-1.5">
          {[
            { label: 'Adres', value: state.adres || '—', done: !!state.adres },
            { label: 'ROI berekend', value: state.roiResult ? `€${state.roiResult.scenarioNu.besparingJaarEur}/jaar besparing` : 'Niet berekend', done: !!state.roiResult },
            { label: 'Meterkast', value: state.meterkastAnalyse ? (state.meterkastAnalyse.geschikt ? 'Geschikt ✓' : 'Advies nodig') : 'Niet gescand', done: !!state.meterkastAnalyse },
            { label: 'Plaatsing', value: state.plaatsingsAnalyse ? `Score ${state.plaatsingsAnalyse.geschiktheidScore}/10` : 'Niet beoordeeld', done: !!state.plaatsingsAnalyse },
            { label: 'Omvormer', value: state.omvormerAnalyse ? `${state.omvormerAnalyse.merk ?? 'Onbekend'}` : 'Niet gescand', done: !!state.omvormerAnalyse },
          ].map(({ label, value, done }) => (
            <div key={label} className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">{label}</span>
              <span className={done ? 'text-slate-700' : 'text-slate-400'}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {[
          { id: 'lead-naam', label: 'Naam *', type: 'text', key: 'naam' as const, placeholder: 'Uw volledige naam', auto: 'name' },
          { id: 'lead-email', label: 'E-mailadres *', type: 'email', key: 'email' as const, placeholder: 'uw@email.nl', auto: 'email' },
          { id: 'lead-telefoon', label: 'Telefoonnummer *', type: 'tel', key: 'telefoon' as const, placeholder: '06 12345678', auto: 'tel' },
        ].map(({ id, label, type, key, placeholder, auto }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-widest" htmlFor={id}>{label}</label>
            <input
              id={id} type={type} value={form[key] as string}
              onChange={(e) => { setForm(f => ({ ...f, [key]: e.target.value })); setErrors(er => ({ ...er, [key]: undefined })) }}
              placeholder={placeholder} disabled={loading} autoComplete={auto}
              className={[inputBase, errors[key] ? 'border-red-400 focus:border-red-400' : 'border-slate-300 focus:border-amber-500'].join(' ')}
            />
            {errors[key] && <p className="text-xs font-mono text-red-600">{errors[key]}</p>}
          </div>
        ))}

        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer group" htmlFor="lead-gdpr">
            <div className="relative mt-0.5 shrink-0">
              <input id="lead-gdpr" type="checkbox" checked={form.gdprConsent}
                onChange={(e) => { setForm(f => ({ ...f, gdprConsent: e.target.checked })); setErrors(er => ({ ...er, gdprConsent: undefined })) }}
                className="sr-only peer" disabled={loading} />
              <div className={['w-4 h-4 rounded border-2 transition-colors peer-focus:ring-2 peer-focus:ring-amber-500/40',
                form.gdprConsent ? 'bg-amber-500 border-amber-500' : errors.gdprConsent ? 'bg-transparent border-red-400' : 'bg-transparent border-slate-300 group-hover:border-amber-500',
              ].join(' ')}>
                {form.gdprConsent && (
                  <svg className="w-full h-full text-white" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3 3 7-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs font-mono text-slate-500 leading-relaxed">
              Ja, ik ontvang graag mijn Persoonlijke 2027-Rapport. Ik geef toestemming om mijn scandata te laten valideren door een gecertificeerde energie-expert van SaldeerScan.nl in mijn regio voor een definitief configuratie-advies.{' '}
              <a href="/privacy" className="text-amber-600 hover:text-amber-500 underline" target="_blank" rel="noopener noreferrer">Privacyverklaring →</a>
            </span>
          </label>
          {errors.gdprConsent && <p className="text-xs font-mono text-red-600 pl-7">{errors.gdprConsent}</p>}
        </div>

        {(errors.submit || submitError) && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-xs font-mono text-red-600">{errors.submit ?? submitError}</p>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full bg-[#00aa65] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-full transition-colors font-mono text-sm flex items-center justify-center gap-2">
          {loading ? (
            <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />Indienen...</>
          ) : 'Offerte aanvragen →'}
        </button>

        <p className="text-[10px] font-mono text-slate-400 text-center">
          Uw data wordt beveiligd verwerkt en gevalideerd door een gecertificeerde expert in {regio} voor een definitieve 2027-check.
        </p>
      </form>

      <button onClick={() => dispatch({ type: 'SET_STEP', step: 5 })} disabled={loading}
        className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-mono text-sm py-2.5 px-4 rounded-full transition-colors">
        ← Terug
      </button>
    </div>
  )
}
