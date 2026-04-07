import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { screenImage } from '@/lib/gemini'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// --- Types ---

export interface MeterkastAnalyse {
  merk: string | null           // ABB, Hager, Schneider, Gewiss, Onbekend
  drieFase: boolean
  vrijeGroepen: number          // Aantal vrije/beschikbare groepen
  maxVermogenKw: number | null  // Max aansluitvermogen in kW
  geschikt: boolean             // Geschikt voor zonnepanelen/batterij?
  opmerkingen: string[]
}

export interface PlaatsingsAnalyse {
  nenCompliant: boolean         // NEN 2078:2023 compliant?
  risicoItems: string[]         // Geïdentificeerde risico's
  aanbevelingen: string[]
  geschiktheidScore: number     // 0-10
}

export interface OmvormerAnalyse {
  merk: string | null
  model: string | null
  vermogenKw: number | null
  hybrideKlaar: boolean         // Heeft hybride batterij-poort?
  vervangenNodig: boolean       // Te oud of incompatibel?
  opmerkingen: string[]
}

// --- Private: Deep analysis with Claude Sonnet ---

const SCREENING_THRESHOLD = 0.7  // Minimum confidence for Tier 1 pass

async function deepAnalyseMeterkast(imageBase64: string): Promise<MeterkastAnalyse> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
        },
        {
          type: 'text',
          text: `Analyseer dit meterkast voor installatie van zonnepanelen of thuisbatterij in Nederland.

Identificeer:
1. Merk (ABB, Hager, Schneider Electric, Gewiss, of Onbekend)
2. Is 3-fase aansluiting aanwezig? (zoek naar 3 hoofdzekeringen of 3-fase hoofdschakelaar)
3. Aantal vrije/ongebruikte groepen (lege railposities)
4. Geschat max aansluitvermogen in kW (3-fase = 3×25A×230V = 17.25 kW)
5. Is het meterkast geschikt voor uitbreiding?
6. Opmerkingen (verouderd, beschadigd, etc.)

Antwoord uitsluitend in dit JSON formaat:
{
  "merk": "string of null",
  "drie_fase": boolean,
  "vrije_groepen": number,
  "max_vermogen_kw": number or null,
  "geschikt": boolean,
  "opmerkingen": ["string", ...]
}`,
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude kon meterkast niet analyseren')
  const parsed = JSON.parse(jsonMatch[0])

  return {
    merk: parsed.merk || null,
    drieFase: Boolean(parsed.drie_fase),
    vrijeGroepen: Number(parsed.vrije_groepen) || 0,
    maxVermogenKw: parsed.max_vermogen_kw != null ? Number(parsed.max_vermogen_kw) : null,
    geschikt: Boolean(parsed.geschikt),
    opmerkingen: Array.isArray(parsed.opmerkingen) ? parsed.opmerkingen : [],
  }
}

async function deepAnalysePlaatsing(imageBase64: string): Promise<PlaatsingsAnalyse> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
        },
        {
          type: 'text',
          text: `Beoordeel deze locatie voor plaatsing van een thuisbatterij op NEN 2078:2023 brandveiligheid.

Controleer:
1. Afstand tot brandbare materialen (minimum 50cm vereist)
2. Ventilatie aanwezig?
3. Toegankelijkheid voor onderhoud
4. Aanwezigheid van waterleiding/gas (risico)
5. Temperatuurklimaat (garage in direct zonlicht = risico)

Geef een geschiktheidsscore 0-10 (10 = perfect).

Antwoord uitsluitend in dit JSON formaat:
{
  "nen_compliant": boolean,
  "risico_items": ["string", ...],
  "aanbevelingen": ["string", ...],
  "geschiktheid_score": number
}`,
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude kon plaatsingslocatie niet analyseren')
  const parsed = JSON.parse(jsonMatch[0])

  return {
    nenCompliant: Boolean(parsed.nen_compliant),
    risicoItems: Array.isArray(parsed.risico_items) ? parsed.risico_items : [],
    aanbevelingen: Array.isArray(parsed.aanbevelingen) ? parsed.aanbevelingen : [],
    geschiktheidScore: Math.min(10, Math.max(0, Number(parsed.geschiktheid_score) || 0)),
  }
}

async function deepAnalyseOmvormer(imageBase64: string): Promise<OmvormerAnalyse> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
        },
        {
          type: 'text',
          text: `Identificeer deze omvormer/inverter voor zonnepanelen.

Bepaal:
1. Merk (SolarEdge, SMA, Fronius, Enphase, Growatt, Huawei, etc.)
2. Model (lees label/sticker)
3. Vermogen in kW
4. Is het een hybride omvormer (geschikt voor thuisbatterij aansluiting)?
5. Moet de omvormer vervangen worden? (ouder dan 15 jaar of incompatibel met hybride systemen)
6. Opmerkingen

Antwoord uitsluitend in dit JSON formaat:
{
  "merk": "string of null",
  "model": "string of null",
  "vermogen_kw": number or null,
  "hybride_klaar": boolean,
  "vervangen_nodig": boolean,
  "opmerkingen": ["string", ...]
}`,
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude kon omvormer niet analyseren')
  const parsed = JSON.parse(jsonMatch[0])

  return {
    merk: parsed.merk || null,
    model: parsed.model || null,
    vermogenKw: parsed.vermogen_kw != null ? Number(parsed.vermogen_kw) : null,
    hybrideKlaar: Boolean(parsed.hybride_klaar),
    vervangenNodig: Boolean(parsed.vervangen_nodig),
    opmerkingen: Array.isArray(parsed.opmerkingen) ? parsed.opmerkingen : [],
  }
}

// --- Public API: Two-tier (Gemini screen → Claude deep) ---

export class VisionScreeningError extends Error {
  constructor(
    public imageType: string,
    public confidence: number,
    public redenering: string
  ) {
    super(`Afbeelding niet herkend als ${imageType} (confidence: ${confidence})`)
    this.name = 'VisionScreeningError'
  }
}

export async function analyseMeterkast(imageBase64: string): Promise<MeterkastAnalyse> {
  const screening = await screenImage(imageBase64, 'meterkast')
  if (!screening.isCorrectType || screening.confidence < SCREENING_THRESHOLD) {
    throw new VisionScreeningError('meterkast', screening.confidence, screening.redenering)
  }
  return deepAnalyseMeterkast(imageBase64)
}

export async function analysePlaatsing(imageBase64: string): Promise<PlaatsingsAnalyse> {
  const screening = await screenImage(imageBase64, 'plaatsingslocatie')
  if (!screening.isCorrectType || screening.confidence < SCREENING_THRESHOLD) {
    throw new VisionScreeningError('plaatsingslocatie', screening.confidence, screening.redenering)
  }
  return deepAnalysePlaatsing(imageBase64)
}

export async function analyseOmvormer(imageBase64: string): Promise<OmvormerAnalyse> {
  const screening = await screenImage(imageBase64, 'omvormer')
  if (!screening.isCorrectType || screening.confidence < SCREENING_THRESHOLD) {
    throw new VisionScreeningError('omvormer', screening.confidence, screening.redenering)
  }
  return deepAnalyseOmvormer(imageBase64)
}
