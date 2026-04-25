import { applyRateLimit } from '@/lib/rate-limit'
import { getBagData } from '@/lib/bag'

export async function GET(request: Request) {
  // Rate limit by IP
  const { response: limitResponse, rl } = await applyRateLimit(request)
  if (limitResponse) return limitResponse

  const { searchParams } = new URL(request.url)
  const adres = searchParams.get('adres')
  if (!adres || adres.trim().length < 5) {
    return Response.json({ error: 'Adres parameter vereist (min 5 tekens)' }, { status: 400 })
  }

  const result = await getBagData(adres)
  if (!result) {
    return Response.json({ error: 'Adres niet gevonden in BAG' }, { status: 404 })
  }

  return Response.json(result, {
    headers: {
      'X-RateLimit-Remaining': String(rl!.remaining),
      'Cache-Control': 'public, max-age=86400', // Cache BAG data 24h (it doesn't change often)
    },
  })
}
