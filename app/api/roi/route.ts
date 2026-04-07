import { applyRateLimit } from '@/lib/rate-limit'
import { berekenROI, ROIInput } from '@/lib/roi'
import { berekenHealthScore } from '@/lib/health-score'

export async function POST(request: Request) {
  const limitResult = applyRateLimit(request)
  if (limitResult.response) return limitResult.response

  const body = await request.json()
  const { oppervlakte, bouwjaar, dakOppervlakte, huidigVerbruikKwh, budgetEur,
          energielabel, netcongestieStatus } = body

  if (!oppervlakte || !bouwjaar || !dakOppervlakte) {
    return Response.json({ error: 'oppervlakte, bouwjaar en dakOppervlakte zijn verplicht' }, { status: 400 })
  }

  const roiInput: ROIInput = { oppervlakte, bouwjaar, dakOppervlakte, huidigVerbruikKwh, budgetEur }
  const roi = berekenROI(roiInput)
  const health = berekenHealthScore({ bouwjaar, energielabel, dakOppervlakte, netcongestieStatus })

  return Response.json({ roi, health }, {
    headers: { 'X-RateLimit-Remaining': String(limitResult.rl!.remaining) }
  })
}
