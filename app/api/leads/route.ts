import { applyRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { dispatchToPartners, dispatchToBulkBuyer } from '@/lib/webhooks'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
if (!resend) console.warn('[api/leads] RESEND_API_KEY niet ingesteld — bevestigingsmail wordt overgeslagen')

export async function POST(request: Request) {
  const limitResult = await applyRateLimit(request, 10, 3_600_000) // 10 leads per IP per hour
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
      huisnummer: body.huisnummer ? String(body.huisnummer) : null,
      wijk: body.wijk ? String(body.wijk) : null,
      stad: body.stad ? String(body.stad) : null,
      provincie: body.provincie ? String(body.provincie) : null,
      lat: body.lat ? Number(body.lat) : null,
      lon: body.lon ? Number(body.lon) : null,

      // BAG + scoring data
      bag_data: body.bagData ?? {},
      ep_data: body.epData ?? {},
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

      // Kwalificatie
      is_eigenaar: typeof body.isEigenaar === 'boolean' ? body.isEigenaar : null,
      heeft_panelen: typeof body.heeftPanelen === 'boolean' ? body.heeftPanelen : null,
      dakrichting: body.dakrichting ? String(body.dakrichting) : null,
      verbruik_bron: body.verbruik_bron ? String(body.verbruik_bron) : 'schatting',
      huishouden_grootte: body.huishouden_grootte ? Number(body.huishouden_grootte) : null,

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

  // Dispatch to bulk buyer if configured (fire and forget)
  dispatchToBulkBuyer({ ...lead, gdpr_consent: body.gdprConsent }).catch(err =>
    console.error('[api/leads] bulk buyer dispatch error:', err)
  )

  // Send confirmation email (awaited — fire-and-forget laat Promise vallen in serverless)
  if (resend) {
    type RoiResult = {
      aantalPanelen?: number
      scenarioNu?: { besparingJaarEur?: number; terugverdientijdJaar?: number }
      shockEffect2027?: { jaarlijksVerlies?: number }
      isdeSchatting?: { bedragEur?: number }
    }
    const roi = (body.roiResult ?? {}) as RoiResult

    const score          = body.healthScore ? Number(body.healthScore) : null
    const energielabel   = body.energielabel ? String(body.energielabel) : null
    const netStatus      = body.netcongestieStatus ? String(body.netcongestieStatus) : null
    const besparing      = roi.scenarioNu?.besparingJaarEur ?? null
    const terugverdien   = roi.scenarioNu?.terugverdientijdJaar ?? null
    const aantalPanelen  = roi.aantalPanelen ?? null
    const verliesNa2027  = roi.shockEffect2027?.jaarlijksVerlies ?? null
    const isdeSubsidie   = roi.isdeSchatting?.bedragEur && roi.isdeSchatting.bedragEur > 0
      ? roi.isdeSchatting.bedragEur : null

    const voornaam = String(naam).split(' ')[0]

    const netKleur: Record<string, string> = {
      GROEN: '#10b981', ORANJE: '#f59e0b', ROOD: '#ef4444',
    }
    const netDot = netStatus
      ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${netKleur[netStatus] ?? '#94a3b8'};margin-right:6px;vertical-align:middle"></span>`
      : ''

    const dataRij = (label: string, waarde: string) =>
      `<tr>
        <td style="padding:7px 0;font-size:13px;color:#94a3b8;border-bottom:1px solid rgba(255,255,255,0.06)">${label}</td>
        <td style="padding:7px 0;font-size:13px;font-weight:600;color:#e2e8f0;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06)">${waarde}</td>
      </tr>`

    const dataRijen = [
      score         !== null ? dataRij('Energie Score', `<span style="color:#f59e0b">${score}/100</span>`) : '',
      energielabel              ? dataRij('Energielabel', energielabel) : '',
      netStatus                 ? dataRij('Netcongestie', `${netDot}${netStatus}`) : '',
      aantalPanelen !== null    ? dataRij('Aanbevolen panelen', `${aantalPanelen} stuks`) : '',
      besparing     !== null    ? dataRij('Geschatte besparing', `<span style="color:#10b981">€${besparing.toLocaleString('nl-NL')}/jaar</span>`) : '',
      isdeSubsidie  !== null    ? dataRij('ISDE subsidie', `<span style="color:#10b981">€${isdeSubsidie.toLocaleString('nl-NL')}</span>`) : '',
      terugverdien  !== null    ? dataRij('Terugverdientijd', `${terugverdien} jaar`) : '',
    ].filter(Boolean).join('')

    try {
    const emailResult = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: String(email),
      subject: `Uw persoonlijk 2027-rapport is klaar, ${voornaam}`,
      html: `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
</head>
<body style="margin:0;padding:0;background:#020617;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:580px;margin:32px auto;background:#0f172a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)">

    <!-- HEADER -->
    <div style="background:#020617;padding:28px 32px 24px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;margin-right:10px">
              <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" fill="none" stroke="#f59e0b" stroke-width="1.5"/>
              <polygon points="14,7 21,11 21,17 14,21 7,17 7,11" fill="#f59e0b" opacity="0.15"/>
              <path d="M14 9 L17 14 L14 19 L11 14 Z" fill="#f59e0b"/>
            </svg>
            <span style="font-size:18px;font-weight:700;color:#f59e0b;vertical-align:middle;letter-spacing:-0.3px">SaldeerScan.nl</span>
          </td>
          <td style="text-align:right;vertical-align:middle">
            <span style="font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:1.5px;text-transform:uppercase">Persoonlijk Rapport</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- URGENTIE BAR -->
    <div style="background:#1c1208;border-top:1px solid rgba(245,158,11,0.3);padding:9px 32px">
      <span style="font-size:11px;color:#fbbf24;letter-spacing:0.3px">Salderingsregeling stopt volledig per 1 januari 2027</span>
    </div>

    <!-- BODY -->
    <div style="padding:32px">
      <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#e2e8f0">Geachte ${voornaam},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.75">
        Uw persoonlijk 2027-rapport voor <strong style="color:#e2e8f0">${String(body.adres)}</strong> is opgesteld.
        Een energieadviseur in uw regio neemt zo spoedig mogelijk contact met u op.
      </p>

      ${verliesNa2027 ? `
      <!-- SHOCK BOX -->
      <div style="background:rgba(28,18,8,0.95);border-radius:10px;border-left:4px solid #f59e0b;padding:18px 20px;margin-bottom:24px">
        <div style="font-size:10px;color:#fbbf24;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;font-weight:600;opacity:0.7">Uw 2027-impact</div>
        <div style="font-size:28px;font-weight:800;color:#fbbf24;letter-spacing:-0.5px;margin-bottom:4px">
          &minus;€${verliesNa2027.toLocaleString('nl-NL')}<span style="font-size:14px;font-weight:500">/jaar</span>
        </div>
        <div style="font-size:12px;color:#fbbf24;opacity:0.7">Verlies per jaar als u nu géén actie onderneemt</div>
      </div>
      ` : ''}

      ${dataRijen ? `
      <!-- SCAN DATA -->
      <div style="margin-bottom:24px">
        <div style="font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;font-weight:600">Uw scanresultaten</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${dataRijen}
        </table>
      </div>
      ` : ''}

      <!-- CTA BUTTON -->
      <div style="text-align:center;margin-bottom:28px">
        <a href="https://saldeerscan.nl/check?adres=${encodeURIComponent(String(body.adres))}" style="display:inline-block;background:#f59e0b;color:#020617;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:8px;letter-spacing:0.2px">
          Bekijk uw rapport op SaldeerScan.nl
        </a>
      </div>

      <!-- WAT NU -->
      <div style="background:#1e293b;border-radius:10px;padding:18px 20px;margin-bottom:0">
        <div style="font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;font-weight:600">Wat nu?</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:28px;vertical-align:top;padding-bottom:10px">
              <div style="width:20px;height:20px;border-radius:50%;background:#020617;color:#f59e0b;font-size:11px;font-weight:700;text-align:center;line-height:20px">1</div>
            </td>
            <td style="padding-bottom:10px;padding-left:10px;font-size:13px;color:#94a3b8;line-height:1.5;vertical-align:top">
              <strong style="color:#e2e8f0">Adviseur neemt contact op</strong> — een gecertificeerde energieadviseur uit uw regio neemt zo spoedig mogelijk contact met u op.
            </td>
          </tr>
          <tr>
            <td style="width:28px;vertical-align:top;padding-bottom:10px">
              <div style="width:20px;height:20px;border-radius:50%;background:#020617;color:#f59e0b;font-size:11px;font-weight:700;text-align:center;line-height:20px">2</div>
            </td>
            <td style="padding-bottom:10px;padding-left:10px;font-size:13px;color:#94a3b8;line-height:1.5;vertical-align:top">
              <strong style="color:#e2e8f0">Gratis locatiecheck</strong> — uw dak, situatie en netaansluiting worden ter plaatse beoordeeld.
            </td>
          </tr>
          <tr>
            <td style="width:28px;vertical-align:top">
              <div style="width:20px;height:20px;border-radius:50%;background:#020617;color:#f59e0b;font-size:11px;font-weight:700;text-align:center;line-height:20px">3</div>
            </td>
            <td style="padding-left:10px;font-size:13px;color:#94a3b8;line-height:1.5;vertical-align:top">
              <strong style="color:#e2e8f0">Definitief advies</strong> — u ontvangt een vrijblijvende offerte op maat, inclusief de actuele ISDE-subsidiemogelijkheden.
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="background:#020617;border-top:1px solid rgba(255,255,255,0.08);padding:16px 32px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size:11px;color:rgba(255,255,255,0.3);line-height:1.6">
            © ${new Date().getFullYear()} SaldeerScan.nl &nbsp;·&nbsp; AVG-compliant<br>
            <a href="mailto:info@saldeerscan.nl" style="color:rgba(255,255,255,0.3);text-decoration:none">info@saldeerscan.nl</a><br>
            <span style="font-size:10px">U ontvangt geen verdere e-mails van ons. Dit is een eenmalige bevestiging.</span>
          </td>
        </tr>
      </table>
    </div>

  </div>
</body>
</html>`,
    })
    if ('error' in emailResult && emailResult.error) {
      console.error('[api/leads] email error:', emailResult.error)
    }
    } catch (err) {
      console.error('[api/leads] email exception:', err)
    }
  }

  return Response.json({ leadId: lead.id, status: 'ingediend' }, { status: 201 })
}
