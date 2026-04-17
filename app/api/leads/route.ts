import { applyRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { dispatchToPartners } from '@/lib/webhooks'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

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
    console.error('[api/leads] insert error:', error?.message, 'code:', error?.code)
    if (error?.code === '23505') {
      return Response.json(
        { error: 'U heeft al een rapport aangevraagd met dit e-mailadres. Controleer uw inbox (ook de spammap).' },
        { status: 409 }
      )
    }
    return Response.json({ error: 'Lead kon niet worden opgeslagen' }, { status: 500 })
  }

  // Dispatch to B2B partners asynchronously (fire and forget)
  dispatchToPartners(lead.id).catch(err =>
    console.error('[api/leads] webhook dispatch error:', err)
  )

  // Send confirmation email (fire and forget)
  if (resend) {
    const score = body.healthScore ? Number(body.healthScore) : null
    const besparing = (body.roiResult as { scenarioNu?: { besparingJaarEur?: number } } | null)?.scenarioNu?.besparingJaarEur ?? null

    resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'SaldeerScan.nl <noreply@saldeerscan.nl>',
      to: String(email),
      subject: `Uw gratis PDF-rapport is klaar — SaldeerScan.nl`,
      html: `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;margin-top:24px;margin-bottom:24px;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:#020617;padding:28px 32px">
      <div style="font-size:20px;font-weight:700;color:#f59e0b;margin-bottom:4px">SaldeerScan.nl</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase">Persoonlijk 2027-Rapport</div>
    </div>
    <div style="background:#7c2d12;padding:10px 32px">
      <span style="font-size:11px;color:#fca5a5">⚠ Per 1 januari 2027 stopt de salderingsregeling volledig — uw voordeel van 28% (2026) vervalt</span>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 8px;font-size:15px;color:#0f172a">Geachte ${String(naam)},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6">
        Uw persoonlijk 2027-rapport voor <strong>${String(body.adres)}</strong> is aangemaakt.
        Open de SaldeerScan-pagina opnieuw om uw PDF te downloaden.
      </p>

      ${score || besparing ? `
      <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:24px;border-left:4px solid #f59e0b">
        <div style="font-size:10px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Uw scanresultaten</div>
        ${score ? `<div style="font-size:13px;color:#0f172a;margin-bottom:4px">Energie Score: <strong style="color:#f59e0b">${score}/100</strong></div>` : ''}
        ${besparing ? `<div style="font-size:13px;color:#0f172a">Geschatte besparing: <strong style="color:#10b981">€${besparing.toLocaleString('nl-NL')}/jaar</strong></div>` : ''}
      </div>
      ` : ''}

      <a href="https://saldeerscan.nl/check" style="display:inline-block;background:#f59e0b;color:#020617;font-weight:700;padding:14px 28px;border-radius:100px;text-decoration:none;font-size:14px;margin-bottom:24px">
        Download uw PDF-rapport →
      </a>

      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
        Geen actie nodig — een gecertificeerde energie-expert in uw regio bekijkt uw dossier en neemt binnen 24 uur contact op.
      </p>
    </div>
    <div style="background:#020617;padding:16px 32px;display:flex;justify-content:space-between">
      <span style="font-size:11px;color:rgba(255,255,255,0.3)">© 2026 SaldeerScan.nl · AVG-compliant</span>
    </div>
  </div>
</body>
</html>`,
    }).then(result => {
      if ('error' in result && result.error) {
        console.error('[api/leads] email error:', result.error)
      }
    }).catch(err => console.error('[api/leads] email error:', err))
  }

  return Response.json({ leadId: lead.id, status: 'ingediend' }, { status: 201 })
}
