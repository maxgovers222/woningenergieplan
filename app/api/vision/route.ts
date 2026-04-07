import { applyRateLimit } from '@/lib/rate-limit'
import {
  analyseMeterkast, analysePlaatsing, analyseOmvormer,
  VisionScreeningError
} from '@/lib/vision'

type VisionType = 'meterkast' | 'plaatsingslocatie' | 'omvormer'

export async function POST(request: Request) {
  const limitResult = applyRateLimit(request, 10, 3_600_000) // 10 vision requests per hour
  if (limitResult.response) return limitResult.response

  let body: { type: VisionType; imageBase64: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Ongeldig JSON body' }, { status: 400 })
  }

  const { type, imageBase64 } = body

  if (!type || !['meterkast', 'plaatsingslocatie', 'omvormer'].includes(type)) {
    return Response.json({ error: 'type moet "meterkast", "plaatsingslocatie" of "omvormer" zijn' }, { status: 400 })
  }

  if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length < 100) {
    return Response.json({ error: 'imageBase64 is vereist' }, { status: 400 })
  }

  try {
    let result
    if (type === 'meterkast') result = await analyseMeterkast(imageBase64)
    else if (type === 'plaatsingslocatie') result = await analysePlaatsing(imageBase64)
    else result = await analyseOmvormer(imageBase64)

    return Response.json({ type, analyse: result })
  } catch (err) {
    if (err instanceof VisionScreeningError) {
      return Response.json({
        error: 'Afbeelding niet herkend',
        detail: err.redenering,
        confidence: err.confidence,
        tip: `Upload een duidelijke foto van een ${err.imageType}`,
      }, { status: 422 })
    }
    console.error('[api/vision] error:', err)
    return Response.json({ error: 'Vision analyse tijdelijk niet beschikbaar' }, { status: 500 })
  }
}
