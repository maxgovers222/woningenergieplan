import { applyRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { dispatchToPartners } from '@/lib/webhooks'

export async function POST(request: Request) {
  const limitResult = applyRateLimit(request, 3, 3_600_000) // 3 leads per IP per hour
  if (limitResult.response) return limitResult.response

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Ongeldig JSON body' }, { status: 400 })
  }

  // Validate required fields
  const { naam, email, telefoon, adres, gdprConsent } = body
  if (!naam || !email || !telefoon || !adres) {
    return Response.json({ error: 'naam, email, telefoon en adres zijn verplicht' }, { status: 400 })
  }
  if (!gdprConsent) {
    return Response.json({ error: 'GDPR consent is vereist' }, { status: 400 })
  }

  // Get IP for consent logging
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1'

  // Insert lead
  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .insert({
      naam: String(naam),
      email: String(email),
      telefoon: String(telefoon),
      adres: String(adres),
      postcode: body.postcode ? String(body.postcode) : null,
      stad: body.stad ? String(body.stad) : null,
      provincie: body.provincie ? String(body.provincie) : null,
      lat: body.lat ? Number(body.lat) : null,
      lon: body.lon ? Number(body.lon) : null,

      // BAG + scoring data
      bag_data: body.bagData ?? {},
      energielabel: body.energielabel ? String(body.energielabel) : null,
      health_score: body.healthScore ? Number(body.healthScore) : null,
      netcongestie_status: body.netcongestieStatus ? String(body.netcongestieStatus) : null,
      roi_berekening: body.roiResult ?? {},

      // Vision analyses
      meterkast_analyse: body.meterkastAnalyse ?? {},
      plaatsing_analyse: body.plaatsingsAnalyse ?? {},
      omvormer_analyse: body.omvormerAnalyse ?? {},

      // ISDE subsidie pre-fill (from ROI result)
      isde_pre_fill: body.isdeSchatting ?? {},

      // GDPR consent (juridische shield)
      gdpr_consent: true,
      consent_timestamp: new Date().toISOString(),
      consent_ip: ip,
      consent_tekst: 'Ja, ik ontvang graag mijn Persoonlijke 2027-Rapport. Ik geef toestemming om mijn scandata te laten valideren door een gecertificeerde energie-expert van SaldeerScan.nl in mijn regio voor een definitief configuratie-advies.',

      // Funnel metadata
      funnel_step: 6,
      funnel_completed: true,

      // UTM tracking
      utm_source: body.utmSource ? String(body.utmSource) : null,
      utm_medium: body.utmMedium ? String(body.utmMedium) : null,
      utm_campaign: body.utmCampaign ? String(body.utmCampaign) : null,
      landing_page: body.landingPage ? String(body.landingPage) : null,
    })
    .select('id')
    .single()

  if (error || !lead) {
    console.error('[api/leads] insert error:', error?.message)
    return Response.json({ error: 'Lead kon niet worden opgeslagen' }, { status: 500 })
  }

  // Dispatch to B2B partners asynchronously (fire and forget)
  // We don't await this — don't block the user response on webhook delivery
  dispatchToPartners(lead.id).catch(err =>
    console.error('[api/leads] webhook dispatch error:', err)
  )

  return Response.json({ leadId: lead.id, status: 'ingediend' }, { status: 201 })
}
