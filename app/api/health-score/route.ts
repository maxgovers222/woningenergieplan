import { applyRateLimit } from '@/lib/rate-limit'
import { berekenHealthScore } from '@/lib/health-score'

export async function GET(request: Request) {
  const limitResult = await applyRateLimit(request)
  if (limitResult.response) return limitResult.response

  const { searchParams } = new URL(request.url)
  const bouwjaar = parseInt(searchParams.get('bouwjaar') ?? '0')
  const energielabel = searchParams.get('energielabel')
  const dakOppervlakte = parseFloat(searchParams.get('dakOppervlakte') ?? '0')
  const netcongestieStatus = searchParams.get('netcongestie') as 'ROOD' | 'ORANJE' | 'GROEN' | null

  if (!bouwjaar || bouwjaar < 1000 || bouwjaar > 2030) {
    return Response.json({ error: 'Geldig bouwjaar vereist (1000-2030)' }, { status: 400 })
  }

  const result = berekenHealthScore({ bouwjaar, energielabel, dakOppervlakte: dakOppervlakte || undefined, netcongestieStatus })
  return Response.json(result, {
    headers: { 'Cache-Control': 'public, max-age=3600' }
  })
}
