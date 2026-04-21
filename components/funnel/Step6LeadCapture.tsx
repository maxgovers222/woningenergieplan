'use client'

import { useState, type Dispatch } from 'react'
import type { FunnelState, FunnelAction } from './types'
import { StepHeader } from './StepHeader'
import { PDFDownloadButton } from './PDFDownloadButton'
import { ResultsDashboard } from './ResultsDashboard'

function extractStad(adres?: string): string {
  if (!adres) return 'Nederland'
  const parts = adres.split(/[,\s]+/)
  return parts[parts.length - 1] || 'Nederland'
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

const COUNTRIES = [
  { code: '+31', label: 'NL', name: 'Nederland',  regex: /^0?[1-9]\d{7,8}$/ },
  { code: '+32', label: 'BE', name: 'België',      regex: /^0?[1-9]\d{7,8}$/ },
  { code: '+49', label: 'DE', name: 'Duitsland',   regex: /^0?[1-9]\d{8,11}$/ },
  { code: '+352', label: 'LU', name: 'Luxemburg',  regex: /^[0-9]\d{5,8}$/ },
] as const

type CountryCode = typeof COUNTRIES[number]['code']

interface LeadFormData {
  naam: string
  email: string
  telefoon: string
  countryCode: CountryCode
  gdprConsent: boolean
}

function normalizePhone(raw: string, code: CountryCode): string {
  const digits = raw.replace(/[\s\-().]/g, '')
  const stripped = digits.startsWith('0') ? digits.slice(1) : digits
  return `${code}${stripped}`
}

function validatePhone(raw: string, code: CountryCode): boolean {
  const digits = raw.replace(/[\s\-().]/g, '')
  const country = COUNTRIES.find(c => c.code === code)
  return country ? country.regex.test(digits) : digits.length >= 7
}

const amberBtnCls = 'bg-amber-500 text-slate-950 font-bold rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:opacity-90 active:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100'

function IsdeSummaryCard({ bedragEur, apparaatType, vermogenKwp }: { bedragEur: number; apparaatType: string; vermogenKwp: number }) {
  if (bedragEur <= 0) return null
  return (
    <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4">
      <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-2">ISDE Subsidie Schatting</div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="font-mono font-bold text-amber-400 text-2xl">€{bedragEur.toLocaleString('nl-NL')}</span>
        <span className="text-xs font-mono text-white/30">via ISDE-regeling</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <div className="text-[10px] font-mono text-white/40">Apparaat</div>
          <div className="text-sm font-mono text-white/70">{apparaatType}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-white/40">Vermogen</div>
          <div className="text-sm font-mono text-white/70">{vermogenKwp} kWp</div>
        </div>
      </div>
    </div>
  )
}

function SuccessState({ state }: { state: FunnelState }) {
  return (
    <div className="space-y-5 py-4">
      {/* Bevestiging header */}
      <div className="text-center pb-2">
        <div className="w-14 h-14 bg-emerald-950/30 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <path d="M6 16l6 6L26 8" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>Gegevens ontvangen!</h3>
        <p className="text-sm text-white/50 mt-1.5 font-mono">Een bevestiging is verstuurd naar uw e-mail</p>
      </div>

      {/* Full results dashboard */}
      <ResultsDashboard state={state} />
    </div>
  )
}

const inputBase = 'w-full bg-slate-900/60 border rounded-lg px-4 py-3 text-white placeholder:text-white/30 font-sans text-sm transition-colors focus:outline-none amber-glow'

export function Step6LeadCapture({ state, dispatch }: Step6LeadCaptureProps) {
  const [form, setForm] = useState<LeadFormData>({ naam: '', email: '', telefoon: '', countryCode: '+31', gdprConsent: false })
  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData | 'submit', string>>>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function validate(): boolean {
    const e: typeof errors = {}
    const naamParts = form.naam.trim().split(/\s+/)
    if (!form.naam.trim()) e.naam = 'Naam is verplicht'
    else if (naamParts.length < 2) e.naam = 'Voer uw voor- en achternaam in'
    const emailNorm = form.email.trim().toLowerCase()
    if (!emailNorm) e.email = 'E-mailadres is verplicht'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailNorm)) e.email = 'Voer een geldig e-mailadres in'
    if (!form.telefoon.trim()) e.telefoon = 'Telefoonnummer is verplicht'
    else if (!validatePhone(form.telefoon, form.countryCode)) e.telefoon = 'Ongeldig telefoonnummer voor het geselecteerde land'
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
          naam: form.naam.trim(), email: form.email.trim().toLowerCase(), telefoon: normalizePhone(form.telefoon, form.countryCode),
          adres: state.adres, postcode: state.bagData?.postcode,
          stad: state.bagData ? extractStad(state.adres) : null,
          provincie: state.netcongestie?.postcodePrefix ? extractProvincie(state.netcongestie.postcodePrefix) : null,
          lat: state.bagData?.lat, lon: state.bagData?.lon, bagData: state.bagData,
          healthScore: state.healthScore?.score, netcongestieStatus: state.netcongestie?.status,
          roiResult: state.roiResult, meterkastAnalyse: state.meterkastAnalyse,
          plaatsingsAnalyse: state.plaatsingsAnalyse, omvormerAnalyse: state.omvormerAnalyse,
          isdeSchatting: state.roiResult?.isdeSchatting, gdprConsent: form.gdprConsent,
          utmSource: state.utmParams?.source,
          utmMedium: state.utmParams?.medium,
          utmCampaign: state.utmParams?.campaign,
          landingPage: state.utmParams?.landingPage,
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

  if (submitted) return <div className="p-6"><SuccessState state={state} /></div>

  const isde = state.roiResult?.isdeSchatting
  const regio = state.wijk || (state.bagData ? state.adres.split(',').pop()?.trim() : null) || 'uw regio'

  return (
    <div className="p-6 space-y-6">
      <StepHeader stap="Stap 6 — Uw rapport" title="Ontvang uw gratis PDF-rapport" subtitle="Vul uw gegevens in — wij sturen het rapport direct naar uw e-mail" />

      {isde && <IsdeSummaryCard {...isde} />}

      {/* PDF delivery promise */}
      <div className="flex items-center gap-3 bg-emerald-950/30 border border-emerald-600/30 rounded-xl px-4 py-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2v6h6M9 13h6M9 17h4" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-emerald-400">U ontvangt gratis een PDF-rapport</p>
          <p className="text-xs font-mono text-white/40 mt-0.5">Direct naar uw e-mail · Geen verplichtingen</p>
        </div>
      </div>

      {/* Floating report preview card */}
      <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 uppercase tracking-widest mb-3">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5.5 5h5M5.5 7.5h5M5.5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Dit staat in uw PDF-rapport
        </div>
        <div className="space-y-1.5 mb-3">
          {[
            { label: 'ROI-berekening', value: state.roiResult ? `€${state.roiResult.scenarioNu.besparingJaarEur.toLocaleString('nl-NL')}/jaar` : '—', done: !!state.roiResult },
            { label: 'ISDE subsidie check', value: isde ? `€${isde.bedragEur.toLocaleString('nl-NL')}` : '—', done: !!isde },
            { label: 'Netcongestie analyse', value: state.netcongestie?.status ?? '—', done: !!state.netcongestie },
            { label: 'Installateur advies', value: 'Zo snel mogelijk', done: true },
            { label: '2027 urgentie tijdlijn', value: 'Inbegrepen', done: true },
          ].map(({ label, value, done }) => (
            <div key={label} className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-1.5 text-white/50">
                <span className={done ? 'text-emerald-400' : 'text-white/20'}>✓</span>
                {label}
              </span>
              <span className="text-white/70 font-semibold">{value}</span>
            </div>
          ))}
        </div>
        {state.adres && (
          <div className="pt-2 border-t border-white/10">
            <div className="text-[10px] font-mono text-white/40 mb-0.5">Adres</div>
            <div className="text-xs font-mono text-white/60 truncate">{state.adres}</div>
          </div>
        )}
        {state.healthScore && (
          <div className="flex gap-4 mt-2">
            <div>
              <div className="text-[10px] font-mono text-white/40">Score</div>
              <div className="text-sm font-mono font-bold text-amber-400">{state.healthScore.score}/100</div>
            </div>
            {state.roiResult && (
              <div>
                <div className="text-[10px] font-mono text-white/40">Besparing/jaar</div>
                <div className="text-sm font-mono font-bold text-emerald-400">€{state.roiResult.scenarioNu.besparingJaarEur.toLocaleString('nl-NL')}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-900/40 border border-white/10 rounded-xl p-4">
        <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-3">Uw energiedossier</div>
        <div className="space-y-1.5">
          {[
            { label: 'Adres', value: state.adres || '—', done: !!state.adres },
            { label: 'ROI berekend', value: state.roiResult ? `€${state.roiResult.scenarioNu.besparingJaarEur}/jaar besparing` : 'Niet berekend', done: !!state.roiResult },
            { label: 'Meterkast', value: state.meterkastAnalyse ? (state.meterkastAnalyse.geschikt ? 'Geschikt ✓' : 'Advies nodig') : 'Niet gescand', done: !!state.meterkastAnalyse },
            { label: 'Plaatsing', value: state.plaatsingsAnalyse ? `Score ${state.plaatsingsAnalyse.geschiktheidScore}/10` : 'Niet beoordeeld', done: !!state.plaatsingsAnalyse },
            { label: 'Omvormer', value: state.omvormerAnalyse ? `${state.omvormerAnalyse.merk ?? 'Onbekend'}` : 'Niet gescand', done: !!state.omvormerAnalyse },
          ].map(({ label, value, done }) => (
            <div key={label} className="flex items-center justify-between text-xs font-mono">
              <span className="text-white/40">{label}</span>
              <span className={done ? 'text-white/70' : 'text-white/30'}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Naam */}
        <div className="space-y-1.5">
          <label className="text-xs font-sans text-white/50 uppercase tracking-widest" htmlFor="lead-naam">Voor- en achternaam *</label>
          <input
            id="lead-naam" type="text" value={form.naam} autoComplete="name"
            onChange={(e) => { setForm(f => ({ ...f, naam: e.target.value })); setErrors(er => ({ ...er, naam: undefined })) }}
            placeholder="Jan de Vries" disabled={loading}
            className={[inputBase, errors.naam ? 'border-red-400' : 'border-white/10'].join(' ')}
          />
          {errors.naam && <p className="text-xs font-sans text-red-400">{errors.naam}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-sans text-white/50 uppercase tracking-widest" htmlFor="lead-email">E-mailadres *</label>
          <input
            id="lead-email" type="email" value={form.email} autoComplete="email"
            onChange={(e) => { setForm(f => ({ ...f, email: e.target.value })); setErrors(er => ({ ...er, email: undefined })) }}
            placeholder="jan@voorbeeld.nl" disabled={loading}
            className={[inputBase, errors.email ? 'border-red-400' : 'border-white/10'].join(' ')}
          />
          {errors.email && <p className="text-xs font-sans text-red-400">{errors.email}</p>}
        </div>

        {/* Telefoon met landselector */}
        <div className="space-y-1.5">
          <label className="text-xs font-sans text-white/50 uppercase tracking-widest" htmlFor="lead-telefoon">Telefoonnummer *</label>
          <div className={['flex rounded-lg border overflow-hidden transition-colors', errors.telefoon ? 'border-red-400' : 'border-white/10'].join(' ')}>
            <select
              value={form.countryCode}
              onChange={(e) => { setForm(f => ({ ...f, countryCode: e.target.value as CountryCode, telefoon: '' })); setErrors(er => ({ ...er, telefoon: undefined })) }}
              disabled={loading}
              className="bg-slate-800/80 text-white/70 text-sm font-sans px-3 py-3 border-r border-white/10 focus:outline-none focus:ring-0 shrink-0"
              aria-label="Landcode"
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.label} {c.code}</option>
              ))}
            </select>
            <input
              id="lead-telefoon" type="tel" value={form.telefoon} autoComplete="tel"
              onChange={(e) => { setForm(f => ({ ...f, telefoon: e.target.value })); setErrors(er => ({ ...er, telefoon: undefined })) }}
              placeholder={form.countryCode === '+31' ? '06 12345678' : form.countryCode === '+32' ? '0478 123456' : '015 12345678'}
              disabled={loading}
              className="flex-1 bg-slate-900/60 px-4 py-3 text-white placeholder:text-white/30 font-mono text-sm focus:outline-none"
            />
          </div>
          {errors.telefoon
            ? <p className="text-xs font-sans text-red-400">{errors.telefoon}</p>
            : form.telefoon && validatePhone(form.telefoon, form.countryCode)
              ? <p className="text-xs font-sans text-emerald-400">Geldig nummer — wordt opgeslagen als {normalizePhone(form.telefoon, form.countryCode)}</p>
              : null
          }
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer group" htmlFor="lead-gdpr">
            <div className="relative mt-0.5 shrink-0">
              <input id="lead-gdpr" type="checkbox" checked={form.gdprConsent}
                onChange={(e) => { setForm(f => ({ ...f, gdprConsent: e.target.checked })); setErrors(er => ({ ...er, gdprConsent: undefined })) }}
                className="sr-only peer" disabled={loading} />
              <div className={['w-4 h-4 rounded border-2 transition-colors peer-focus:ring-2 peer-focus:ring-amber-500/40',
                form.gdprConsent ? 'bg-amber-500 border-amber-500' : errors.gdprConsent ? 'bg-transparent border-red-400' : 'bg-transparent border-white/20 group-hover:border-amber-500',
              ].join(' ')}>
                {form.gdprConsent && (
                  <svg className="w-full h-full text-slate-950" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3 3 7-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs font-sans text-white/50 leading-relaxed">
              Ja, stuur mij het gratis PDF-rapport. Ik geef toestemming om mijn scandata te laten valideren door een gecertificeerde energie-expert van SaldeerScan.nl in mijn regio.{' '}
              <a href="/privacy" className="text-amber-400 hover:text-amber-300 underline" target="_blank" rel="noopener noreferrer">Privacyverklaring →</a>
            </span>
          </label>
          {errors.gdprConsent && <p className="text-xs font-sans text-red-400 pl-7">{errors.gdprConsent}</p>}
        </div>

        {(errors.submit || submitError) && (
          <div className="bg-red-950/40 border border-red-700 rounded-xl px-3 py-2">
            <p className="text-xs font-mono text-red-400">{errors.submit ?? submitError}</p>
          </div>
        )}

        <button type="submit" disabled={loading}
          className={`w-full font-mono text-sm py-3.5 px-6 flex items-center justify-center gap-2 ${amberBtnCls}`}>
          {loading ? (
            <><div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />Indienen...</>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.5 5h5M5.5 7.5h5M5.5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Stuur mij het gratis PDF-rapport
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </>
          )}
        </button>

        <p className="text-[10px] font-mono text-white/30 text-center">
          Uw data wordt beveiligd verwerkt en gevalideerd door een gecertificeerde expert in {regio} voor een definitieve 2027-check.
        </p>
      </form>

      <button onClick={() => dispatch({ type: 'SET_STEP', step: 5 })} disabled={loading}
        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-30 text-white/50 text-sm py-2.5 px-4 rounded-full transition-colors">
        ← Terug
      </button>
    </div>
  )
}
