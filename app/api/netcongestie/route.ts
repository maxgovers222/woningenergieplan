import { applyRateLimit } from '@/lib/rate-limit'
import { getNetcongestie } from '@/lib/netcongestie'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const limitResult = applyRateLimit(request)
  if (limitResult.response) return limitResult.response

  const { searchParams } = new URL(request.url)
  const postcode = searchParams.get('postcode')

  if (!postcode || !/^\d{4}([a-zA-Z]{2})?$/.test(postcode.replace(/\s/g, ''))) {
    return Response.json({ error: 'Geldige postcode vereist (4 cijfers)' }, { status: 400 })
  }

  try {
    const result = await getNetcongestie(postcode)
    return Response.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'X-RateLimit-Remaining': String(limitResult.rl!.remaining),
      }
    })
  } catch (err) {
    console.error('[api/netcongestie] error:', err)
    return Response.json({ error: 'Netcongestie check tijdelijk niet beschikbaar' }, { status: 500 })
  }
}
