import 'server-only'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

// Model instances (lazy — initialized on first use via closure)
function getFlashModel() {
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
}

export interface FAQ {
  vraag: string
  antwoord: string
}

export interface PseoContent {
  titel: string
  metaDescription: string
  hoofdtekst: string   // ~600 woorden, plain text (no HTML)
  faqItems: FAQ[]
}

export interface PseoContentParams {
  straat: string
  stad: string
  provincie: string
  bouwjaar: number
  netcongestie: 'ROOD' | 'ORANJE' | 'GROEN'
  healthScore: number
}

export async function generatePseoContent(params: PseoContentParams): Promise<PseoContent> {
  const model = getFlashModel()

  const prompt = `Je bent een SEO-expert voor de Nederlandse energiemarkt. Schrijf een SEO-artikel van precies 600 woorden voor WoningEnergiePlan.nl.

Onderwerp: Energiebesparing voor woningen op ${params.straat} in ${params.stad}, ${params.provincie}.

Context:
- Gemiddeld bouwjaar in deze straat: ${params.bouwjaar}
- Netcongestie status: ${params.netcongestie}
- Energie score: ${params.healthScore}/100

Focus op: de specifieke uitdagingen voor ${params.bouwjaar} woningen bij het einde van salderen op 1 januari 2027. Bespreek: isolatie-uitdagingen, zonnepaneel-potentieel, batterijopslag als oplossing voor netcongestie.

Schrijf direct voor de huiseigenaar. Gebruik concrete euro-bedragen. Vermijd jargon.

Geef ook:
- Een pakkende SEO-titel (max 60 tekens)
- Een meta-description (max 155 tekens)
- 3 FAQ-vragen met antwoord (elk antwoord 2-3 zinnen)

Antwoord uitsluitend in dit JSON formaat:
{
  "titel": "...",
  "metaDescription": "...",
  "hoofdtekst": "...",
  "faqItems": [
    { "vraag": "...", "antwoord": "..." },
    { "vraag": "...", "antwoord": "..." },
    { "vraag": "...", "antwoord": "..." }
  ]
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  // Extract JSON from response (Gemini sometimes wraps in markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Gemini response bevat geen geldig JSON')

  const parsed = JSON.parse(jsonMatch[0]) as PseoContent
  if (
    !parsed.titel ||
    !parsed.metaDescription ||
    !parsed.hoofdtekst ||
    !Array.isArray(parsed.faqItems) ||
    parsed.faqItems.length === 0
  ) {
    throw new Error('Gemini response mist vereiste velden')
  }

  return parsed
}

// Tier 1 image screening — cheap, fast
export interface ScreeningResult {
  isCorrectType: boolean
  confidence: number  // 0.0 - 1.0
  redenering: string  // Short explanation
}

type ImageType = 'meterkast' | 'plaatsingslocatie' | 'omvormer'

const TYPE_LABELS: Record<ImageType, string> = {
  meterkast: 'een meterkast (elektrisch verdeelkast met groepen/zekeringen)',
  plaatsingslocatie: 'een locatie voor een thuisbatterij (muur/vloer in garage, schuur of technische ruimte)',
  omvormer: 'een omvormer/inverter voor zonnepanelen (elektronisch apparaat met display of LED)',
}

export async function screenImage(
  imageBase64: string,
  imageType: ImageType,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg'
): Promise<ScreeningResult> {
  const model = getFlashModel()

  const prompt = `Is dit een foto van ${TYPE_LABELS[imageType]}?

Antwoord uitsluitend in dit JSON formaat:
{
  "is_correct": true/false,
  "confidence": 0.0-1.0,
  "redenering": "Korte uitleg in 1 zin"
}`

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType,
    },
  }

  const result = await model.generateContent([prompt, imagePart])
  const text = result.response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { isCorrectType: false, confidence: 0, redenering: 'Kon afbeelding niet analyseren' }

  const parsed = JSON.parse(jsonMatch[0])
  return {
    isCorrectType: Boolean(parsed.is_correct),
    confidence: Number(parsed.confidence) || 0,
    redenering: String(parsed.redenering || ''),
  }
}
