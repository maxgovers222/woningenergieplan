import { applyRateLimit } from '@/lib/rate-limit'
import { generatePseoContent, PseoContentParams } from '@/lib/gemini'

export async function POST(request: Request) {
  const limitResult = await applyRateLimit(request, 20, 3_600_000) // 20 content req/hour
  if (limitResult.response) return limitResult.response

  let params: PseoContentParams
  try {
    params = await request.json()
  } catch {
    return Response.json({ error: 'Ongeldig JSON body' }, { status: 400 })
  }

  if (!params.straat || !params.stad || !params.bouwjaar) {
    return Response.json({ error: 'straat, stad en bouwjaar zijn verplicht' }, { status: 400 })
  }

  if (typeof params.bouwjaar !== 'number' || params.bouwjaar < 1800 || params.bouwjaar > 2025) {
    return Response.json({ error: 'bouwjaar moet een getal zijn tussen 1800 en 2025' }, { status: 400 })
  }

  try {
    const content = await generatePseoContent(params)
    return Response.json(content)
  } catch (err) {
    console.error('[api/generate-content] error:', err)
    return Response.json({ error: 'Content generatie tijdelijk niet beschikbaar' }, { status: 500 })
  }
}
