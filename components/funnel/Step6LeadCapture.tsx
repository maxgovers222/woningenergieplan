'use client'

import { useState, type Dispatch } from 'react'
import type { FunnelState, FunnelAction } from './types'

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
    <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-4">
      <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-2">ISDE Subsidie Schatting</div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono font-bold text-amber-400 text-2xl">€{bedragEur.toLocaleString('nl-NL')}</span>
        <span className="text-xs font-mono text-slate-400">via ISDE-regeling</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <div className="text-[10px] font-mono text-slate-500">Apparaat</div>
          <div className="text-sm font-mono text-slate-200">{apparaatType}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-slate-500">Vermogen</div>
          <div className="text-sm font-mono text-slate-200">{vermogenKwp} kWp</div>
        </div>
      </div>
    </div>
  )
}

function SuccessState() {
  return (
    <div className="text-center space-y-4 py-8">
      <div className="w-16 h-16 bg-emerald-900/50 border border-emerald-600 rounded-full flex items-center justify-center mx-auto">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M6 16l6 6L26 8" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <h3 className="text-xl font-bold text-slate-100">Aanvraag ingediend!</h3>
        <p className="text-sm text-slate-400 mt-2 font-mono">
          Een gecertificeerde installateur neemt binnen 24 uur contact op.
        </p>
      </div>
      <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 text-left space-y-2">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Volgende stappen</div>
        {[
          'Installateur bekijkt uw energiedossier',
          'U ontvangt een persoonlijke offerte',
          'Gratis inspectie op locatie',
          'ISDE subsidie aanvraag begeleiding',
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span className="text-emerald-400 font-bold">{i + 1}.</span>
            {step}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Step6LeadCapture({ state, dispatch }: Step6LeadCaptureProps) {
  const [form, setForm] = useState<LeadFormData>({
    naam: '',
    email: '',
    telefoon: '',
    gdprConsent: false,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function validate(): boolean {
    const newErrors: Partial<Record<keyof LeadFormData, string>> = {}

    if (!form.naam.trim()) newErrors.naam = 'Naam is verplicht'
    if (!form.email.trim()) {
      newErrors.email = 'E-mail is verplicht'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Voer een geldig e-mailadres in'
    }
    if (!form.telefoon.trim()) {
      newErrors.telefoon = 'Telefoonnummer is verplicht'
    } else if (form.telefoon.replace(/\s/g, '').length < 10) {
      newErrors.telefoon = 'Voer een geldig telefoonnummer in'
    }
    if (!form.gdprConsent) {
      newErrors.gdprConsent = 'U moet akkoord gaan met de privacyverklaring om door te gaan.'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setSubmitError(null)

    const leadPayload = {
      naam: form.naam,
      email: form.email,
      telefoon: form.telefoon,
      adres: state.adres,
      bagData: state.bagData,
      netcongestie: state.netcongestie,
      healthScore: state.healthScore,
      roiResult: state.roiResult,
      meterkastAnalyse: state.meterkastAnalyse,
      plaatsingsAnalyse: state.plaatsingsAnalyse,
      omvormerAnalyse: state.omvormerAnalyse,
      gdprConsent: true,
      timestamp: new Date().toISOString(),
    }

    try {
      // TODO (Fase 5): POST to /api/leads when the endpoint is implemented
      // const res = await fetch('/api/leads', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(leadPayload),
      // })
      // if (!res.ok) throw new Error('Lead submission failed')

      // Temporary: log to console and simulate success
      console.log('[TODO Fase 5] Lead submission payload:', leadPayload)

      // Simulate network delay for UX
      await new Promise((resolve) => setTimeout(resolve, 800))

      const fakeLeadId = `LEAD-${Date.now()}`
      dispatch({ type: 'SET_LEAD_ID', leadId: fakeLeadId })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Indienen mislukt. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="p-6">
        <SuccessState />
      </div>
    )
  }

  const isde = state.roiResult?.isdeSchatting

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] font-mono text-amber-400 tracking-widest uppercase mb-1">// STAP 06 — AANVRAAG</p>
        <h2 className="text-xl font-bold text-slate-100">Offerte aanvragen</h2>
        <p className="text-sm text-slate-400 mt-0.5">Ontvang een persoonlijke offerte van gecertificeerde installateurs</p>
      </div>

      {/* ISDE summary */}
      {isde && <IsdeSummaryCard {...isde} />}

      {/* Summary of completed steps */}
      <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4">
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Uw energiedossier</div>
        <div className="space-y-1.5">
          {[
            { label: 'Adres', value: state.adres || '—', done: !!state.adres },
            { label: 'ROI berekend', value: state.roiResult ? `€${state.roiResult.scenarioNu.besparingJaarEur}/jaar besparing` : 'Niet berekend', done: !!state.roiResult },
            { label: 'Meterkast', value: state.meterkastAnalyse ? (state.meterkastAnalyse.geschikt ? 'Geschikt ✓' : 'Advies nodig') : 'Niet gescand', done: !!state.meterkastAnalyse },
            { label: 'Plaatsing', value: state.plaatsingsAnalyse ? `Score ${state.plaatsingsAnalyse.geschiktheidScore}/10` : 'Niet beoordeeld', done: !!state.plaatsingsAnalyse },
            { label: 'Omvormer', value: state.omvormerAnalyse ? `${state.omvormerAnalyse.merk ?? 'Onbekend'}` : 'Niet gescand', done: !!state.omvormerAnalyse },
          ].map(({ label, value, done }) => (
            <div key={label} className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">{label}</span>
              <span className={done ? 'text-slate-200' : 'text-slate-600'}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contact form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Naam */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-widest" htmlFor="lead-naam">
            Naam *
          </label>
          <input
            id="lead-naam"
            type="text"
            value={form.naam}
            onChange={(e) => { setForm(f => ({ ...f, naam: e.target.value })); setErrors(er => ({ ...er, naam: undefined })) }}
            placeholder="Uw volledige naam"
            className={[
              'w-full bg-slate-900 border rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-600 font-mono text-sm transition-colors outline-none',
              errors.naam ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30',
            ].join(' ')}
            disabled={loading}
          />
          {errors.naam && <p className="text-xs font-mono text-red-400">{errors.naam}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-widest" htmlFor="lead-email">
            E-mailadres *
          </label>
          <input
            id="lead-email"
            type="email"
            value={form.email}
            onChange={(e) => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: undefined })) }}
            placeholder="uw@email.nl"
            className={[
              'w-full bg-slate-900 border rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-600 font-mono text-sm transition-colors outline-none',
              errors.email ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30',
            ].join(' ')}
            disabled={loading}
            autoComplete="email"
          />
          {errors.email && <p className="text-xs font-mono text-red-400">{errors.email}</p>}
        </div>

        {/* Telefoon */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-widest" htmlFor="lead-telefoon">
            Telefoonnummer *
          </label>
          <input
            id="lead-telefoon"
            type="tel"
            value={form.telefoon}
            onChange={(e) => { setForm(f => ({ ...f, telefoon: e.target.value })); setErrors(er => ({ ...er, telefoon: undefined })) }}
            placeholder="06 12345678"
            className={[
              'w-full bg-slate-900 border rounded-lg px-4 py-3 text-slate-100 placeholder:text-slate-600 font-mono text-sm transition-colors outline-none',
              errors.telefoon ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30',
            ].join(' ')}
            disabled={loading}
            autoComplete="tel"
          />
          {errors.telefoon && <p className="text-xs font-mono text-red-400">{errors.telefoon}</p>}
        </div>

        {/* GDPR Consent */}
        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer group" htmlFor="lead-gdpr">
            <div className="relative mt-0.5 shrink-0">
              <input
                id="lead-gdpr"
                type="checkbox"
                checked={form.gdprConsent}
                onChange={(e) => { setForm(f => ({ ...f, gdprConsent: e.target.checked })); setErrors(er => ({ ...er, gdprConsent: undefined })) }}
                className="sr-only peer"
                disabled={loading}
              />
              <div className={[
                'w-4 h-4 rounded border-2 transition-colors peer-focus:ring-2 peer-focus:ring-amber-500/40',
                form.gdprConsent
                  ? 'bg-amber-500 border-amber-500'
                  : errors.gdprConsent
                  ? 'bg-transparent border-red-500'
                  : 'bg-transparent border-slate-500 group-hover:border-amber-500',
              ].join(' ')}>
                {form.gdprConsent && (
                  <svg className="w-full h-full text-slate-900" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3 3 7-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400 leading-relaxed">
              Ik ga akkoord dat WoningEnergiePlan.nl mijn gegevens deelt met gecertificeerde installateurs
              in mijn regio voor het uitbrengen van een offerte.{' '}
              <a href="/privacy" className="text-amber-400 hover:text-amber-300 underline" target="_blank" rel="noopener noreferrer">
                Privacyverklaring →
              </a>
            </span>
          </label>
          {errors.gdprConsent && (
            <p className="text-xs font-mono text-red-400 pl-7">{errors.gdprConsent}</p>
          )}
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
            <p className="text-xs font-mono text-red-300">{submitError}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-900 font-bold py-3.5 px-6 rounded-lg transition-colors font-mono text-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              Indienen...
            </>
          ) : (
            'Offerte aanvragen →'
          )}
        </button>

        <p className="text-[10px] font-mono text-slate-600 text-center">
          Gratis en vrijblijvend — geen verplichtingen
        </p>
      </form>

      {/* Back button */}
      <button
        onClick={() => dispatch({ type: 'SET_STEP', step: 5 })}
        disabled={loading}
        className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 font-mono text-sm py-2.5 px-4 rounded-lg transition-colors"
      >
        ← Terug
      </button>
    </div>
  )
}
