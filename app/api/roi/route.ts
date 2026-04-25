import { applyRateLimit } from '@/lib/rate-limit'
import { berekenROI, ROIInput } from '@/lib/roi'
import { berekenHealthScore } from '@/lib/health-score'

export async function POST(request: Request) {
  const limitResult = await applyRateLimit(request, 120, 3_600_000)
  if (limitResult.response) return limitResult.response

  const body = await request.json()
  const { oppervlakte, bouwjaar, dakOppervlakte, huidigVerbruikKwh, budgetEur,
          energielabel, netcongestieStatus, aantalPanelenOverride, kwhPerPaneel,
          dakrichting, huishouden_grootte } = body

  if (!oppervlakte || !bouwjaar || !dakOppervlakte) {
    return Response.json({ error: 'oppervlakte, bouwjaar en dakOppervlakte zijn verplicht' }, { status: 400 })
  }
  if (bouwjaar < 1000 || bouwjaar > 2030) {
    return Response.json({ error: 'Bouwjaar moet tussen 1000 en 2030 liggen' }, { status: 400 })
  }
  if (oppervlakte <= 0 || oppervlakte > 2000) {
    return Response.json({ error: 'Oppervlakte moet tussen 1 en 2000 m² liggen' }, { status: 400 })
  }
  if (dakOppervlakte < 0 || dakOppervlakte > 5000) {
    return Response.json({ error: 'DakOppervlakte moet tussen 0 en 5000 m² liggen' }, { status: 400 })
  }

  const roiInput: ROIInput = {
    oppervlakte, bouwjaar, dakOppervlakte, huidigVerbruikKwh, budgetEur,
    aantalPanelenOverride: aantalPanelenOverride ? Number(aantalPanelenOverride) : undefined,
    kwhPerPaneel: kwhPerPaneel ? Number(kwhPerPaneel) : undefined,
    dakrichting: dakrichting ?? null,
    huishouden_grootte: huishouden_grootte ?? null,
  }
  const roi = berekenROI(roiInput)
  const health = berekenHealthScore({ bouwjaar, energielabel, dakOppervlakte, netcongestieStatus })

  return Response.json({ roi, health }, {
    headers: { 'X-RateLimit-Remaining': String(limitResult.rl!.remaining) }
  })
}
