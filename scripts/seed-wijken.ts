/**
 * SaldeerScan.nl — pSEO Wijk Seeder v2
 *
 * Strategie: ALTIJD Gemini 2.5 Flash voor alle wijken — geen templates.
 * Elke pagina krijgt hyperlocale context via CBS PDOK WFS + unieke Gemini prompt.
 *
 * Data-bronnen:
 *   1. Hardcoded wijk-lijst (provincie/stad/bouwjaar/netcongestie)
 *   2. CBS PDOK WFS — aantal woningen per wijk (live fetch per wijk)
 *   3. Gemini 2.5 Flash — 800w unieke tekst + 5 FAQs + JSON-LD
 *
 * Gebruik:
 *   npx tsx scripts/seed-wijken.ts                  # Alle wijken (published)
 *   npx tsx scripts/seed-wijken.ts --dry-run        # Simuleer zonder DB/AI
 *   npx tsx scripts/seed-wijken.ts --skip-existing  # Sla reeds aanwezige over
 *   npx tsx scripts/seed-wijken.ts --batch=0,50     # Subset (index range)
 *
 * Kosten: ~€0.0002/wijk bij Gemini 2.5 Flash. 2000 wijken ≈ €0.40 totaal.
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dir, '..', '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GOOGLE_KEY        = process.env.GOOGLE_AI_API_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY || !GOOGLE_KEY) {
  console.error('\nFout: ontbrekende env vars in .env.local:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_AI_API_KEY\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const genAI    = new GoogleGenerativeAI(GOOGLE_KEY)

// ─── Types ──────────────────────────────────────────────────────────────────

type Netcongestie = 'ROOD' | 'ORANJE' | 'GROEN'

interface WijkEntry {
  wijk:         string
  stad:         string
  provincie:    string
  bouwjaar:     number
  netcongestie: Netcongestie
  /** Optioneel: handmatig opgeven als CBS-fetch mislukt */
  aantalWoningen?: number
}

interface RichContent {
  titel:          string
  metaDescription: string
  hoofdtekst:     string
  faqItems:       { vraag: string; antwoord: string }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function deriveHealthScore(bouwjaar: number, netcongestie: Netcongestie): number {
  let score = 70
  if      (bouwjaar >= 2005) score += 12
  else if (bouwjaar >= 2000) score += 8
  else if (bouwjaar >= 1990) score += 3
  else if (bouwjaar < 1970)  score -= 8
  if (netcongestie === 'ROOD')  score -= 5
  if (netcongestie === 'GROEN') score += 5
  return Math.min(95, Math.max(45, score))
}

// ─── CBS PDOK — aantal woningen per wijk ────────────────────────────────────

async function fetchAantalWoningen(wijk: string, stad: string): Promise<number | null> {
  try {
    const wijkEncoded = encodeURIComponent(wijk)
    const stadEncoded = encodeURIComponent(stad)
    const url = `https://service.pdok.nl/cbs/gebiedsindelingen/2023/wfs/v1_0`
      + `?service=WFS&version=2.0.0&request=GetFeature`
      + `&typeName=cbs_wijk_2023&outputFormat=application/json`
      + `&CQL_FILTER=wijknaam='${wijkEncoded}' AND gemeentenaam='${stadEncoded}'`
      + `&propertyName=wijknaam,gemeentenaam,aantalwoningen`
      + `&count=1`

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const json = await res.json() as { features?: { properties?: { aantalwoningen?: number } }[] }
    const val = json.features?.[0]?.properties?.aantalwoningen
    return typeof val === 'number' && val > 0 ? val : null
  } catch {
    return null
  }
}

// ─── Gemini — unieke SEO-content per wijk ────────────────────────────────────

function buildPrompt(e: WijkEntry, aantalWoningen: number | null, score: number): string {
  const woningenTekst = aantalWoningen
    ? `${aantalWoningen.toLocaleString('nl-NL')} woningen (CBS 2023)`
    : 'een significante woningpopulatie'

  const netProfielTekst = {
    ROOD:   `Het elektriciteitsnet in ${e.wijk} staat onder maximale druk (status ROOD bij Netbeheer NL). Teruglevering van zonne-energie wordt hier al gereguleerd. Een thuisbatterij is voor woningbezitters in deze wijk géén luxe maar een noodzaak om zelf opgewekte stroom maximaal te benutten.`,
    ORANJE: `Het stroomnet in ${e.wijk} raakt toenemend vol (status ORANJE). Liander/Enexis verwacht hier in de komende jaren beperkingen op teruglevering. Thuisbatterijen worden daardoor steeds relevanter als buffer.`,
    GROEN:  `De netcapaciteit in ${e.wijk} is momenteel ruim beschikbaar (status GROEN). Dit biedt woningbezitters ideale omstandigheden voor maximale teruglevering — maar ook hier is het zaak vóór 2027 te handelen.`,
  }[e.netcongestie]

  const bouwjaarProfielTekst =
    e.bouwjaar >= 2010
      ? `Woningen in ${e.wijk} zijn overwegend nieuwbouw (${e.bouwjaar}). Ze hebben standaard een moderne groepenkast (3-fase), uitstekende dakisolatie en zijn direct klaar voor zonnepanelen zonder aanpassingen.`
      : e.bouwjaar >= 1995
      ? `Woningen uit de periode ${e.bouwjaar} in ${e.wijk} hebben doorgaans een goede dakconditie. De groepenkast is meestal al geschikt voor een omvormer, al kan een kleine upgrade wenselijk zijn.`
      : e.bouwjaar >= 1980
      ? `Woningen uit ${e.bouwjaar} in ${e.wijk} vereisen soms een groepenkast-upgrade (€300–€600). Het dak is in de meeste gevallen geschikt voor minimaal 10 zonnepanelen.`
      : `Woningen uit ${e.bouwjaar} in ${e.wijk} zijn wat ouder. Dakcheck en groepenkast-inspectie zijn standaard aanbevolen. Renovatiesubsidie (ISDE) kan hier een deel van de extra kosten dekken.`

  const besparingRange = e.bouwjaar >= 2000
    ? '€700–€1.100'
    : e.bouwjaar >= 1985
    ? '€500–€900'
    : '€350–€700'

  const terugverdien = e.netcongestie === 'ROOD'
    ? '6–8 jaar (met batterij: 8–11 jaar)'
    : '7–10 jaar'

  return `Je bent een senior energie-adviseur en SEO-specialist voor de Nederlandse markt. Schrijf een technisch-autoritair SEO-artikel van precies 800 woorden voor SaldeerScan.nl over de wijk ${e.wijk} in ${e.stad}.

HYPERLOCALE DATA (verwerk ALLE van deze specifieke feiten in de tekst):
- Wijk: ${e.wijk}, ${e.stad} (${e.provincie.replace(/-/g, ' ')})
- Aantal woningen: ${woningenTekst}
- Gemiddeld bouwjaar: ${e.bouwjaar}
- Netcongestie (Netbeheer NL): ${e.netcongestie}
- Energie-rendementsscore: ${score}/100
- Geschatte jaarlijkse besparing zonnepanelen: ${besparingRange}
- Terugverdientijd: ${terugverdien}

WIJK-SPECIFIEKE CONTEXT:
${bouwjaarProfielTekst}

NETPROFIEL:
${netProfielTekst}

SCHRIJFINSTRUCTIES:
1. Begin met een krachtige openingszin die ${e.wijk} en 2027 noemt — geen generieke inleiding
2. Verwerk concrete euro-bedragen, het specifieke bouwjaar ${e.bouwjaar} en de netcongestiestatus ${e.netcongestie} in elke sectie
3. Gebruik de term "salderingsregeling" minimaal 3x en "1 januari 2027" minimaal 2x
4. Schrijf in de tweede persoon ("u", "uw woning") — direct tegen de huiseigenaar in ${e.wijk}
5. Geen jargon, geen algemeenheden — iedere alinea moet specifiek voor ${e.wijk} voelen
6. Sluit af met een urgente maar niet agressieve oproep tot actie richting de gratis SaldeerScan

SEO-EISEN:
- Titel: max 60 tekens, bevat "${e.wijk}", "${e.stad}" en "2027"
- Meta-description: max 155 tekens, bevat "${e.wijk}" en "saldering"
- Gebruik H2-achtige tussenkoppen als alinea-openers (vetgedrukte lead-zinnen, geen HTML-tags)
- Voeg **dikgedrukte** kernbegrippen toe via **markdown** (maximaal 8 per tekst)

FAQ (5 stuks — hyperlocaal, niet generiek):
- Vraag 1: specifiek over netcongestie ${e.netcongestie} in ${e.wijk}
- Vraag 2: specifiek over bouwjaar ${e.bouwjaar} en dakgeschiktheid
- Vraag 3: over de financiële impact van 2027 voor woningen in ${e.stad}
- Vraag 4: over ISDE-subsidie en de specifieke situatie in ${e.provincie.replace(/-/g, ' ')}
- Vraag 5: over thuisbatterijen en de lokale netcongestie

Antwoord UITSLUITEND in dit JSON-formaat (geen tekst buiten de JSON):
{
  "titel": "...",
  "metaDescription": "...",
  "hoofdtekst": "...",
  "faqItems": [
    { "vraag": "...", "antwoord": "..." },
    { "vraag": "...", "antwoord": "..." },
    { "vraag": "...", "antwoord": "..." },
    { "vraag": "...", "antwoord": "..." },
    { "vraag": "...", "antwoord": "..." }
  ]
}`
}

async function generateContent(e: WijkEntry, aantalWoningen: number | null): Promise<RichContent> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      // @ts-ignore — thinkingConfig supported in gemini-2.5-flash, kills thinking-token overhead
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  const score = deriveHealthScore(e.bouwjaar, e.netcongestie)
  const prompt = buildPrompt(e, aantalWoningen, score)

  // Retry tot 3x bij Gemini-fouten
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await model.generateContent(prompt)
      const text   = result.response.text()

      // Native JSON mode geeft schone JSON; als fallback: extraheer eerste {...}
      let parsed: RichContent
      try {
        parsed = JSON.parse(text) as RichContent
      } catch {
        const match = text.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Geen JSON in Gemini-respons')
        parsed = JSON.parse(match[0]) as RichContent
      }

      if (!parsed.titel || !parsed.hoofdtekst || !Array.isArray(parsed.faqItems)) {
        throw new Error('Onvolledige JSON-respons')
      }
      if (parsed.faqItems.length < 3) throw new Error('Te weinig FAQ items')
      return parsed
    } catch (err) {
      if (attempt < 3) {
        process.stdout.write(`    ↺ retry ${attempt}/3 voor ${e.wijk}...\n`)
        await sleep(2000 * attempt)
      } else {
        throw err
      }
    }
  }
  throw new Error('Gemini: max retries bereikt')
}

// ─── JSON-LD builder ────────────────────────────────────────────────────────

function buildJsonLd(e: WijkEntry, content: RichContent, aantalWoningen: number | null) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `https://saldeerscan.nl/${e.provincie}/${toSlug(e.stad)}/${toSlug(e.wijk)}#webpage`,
        name: content.titel,
        description: content.metaDescription,
        url: `https://saldeerscan.nl/${e.provincie}/${toSlug(e.stad)}/${toSlug(e.wijk)}`,
        inLanguage: 'nl-NL',
        about: {
          '@type': 'Place',
          name: `${e.wijk}, ${e.stad}`,
          addressLocality: e.stad,
          addressRegion: e.provincie.replace(/-/g, ' '),
          addressCountry: 'NL',
        },
        publisher: {
          '@type': 'Organization',
          name: 'SaldeerScan.nl',
          url: 'https://saldeerscan.nl',
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: content.faqItems.map(faq => ({
          '@type': 'Question',
          name: faq.vraag,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.antwoord,
          },
        })),
      },
    ],
  }
}

// ─── Database upsert ─────────────────────────────────────────────────────────

async function seedWijk(e: WijkEntry, opts: { dryRun: boolean; skipExisting: boolean }) {
  const slug    = `/${e.provincie}/${toSlug(e.stad)}/${toSlug(e.wijk)}`
  const score   = deriveHealthScore(e.bouwjaar, e.netcongestie)

  if (opts.skipExisting) {
    const { data } = await supabase.from('pseo_pages').select('slug').eq('slug', slug).maybeSingle()
    if (data) {
      process.stdout.write(`    SKIP  ${slug}\n`)
      return 'skipped' as const
    }
  }

  // Haal CBS woningcount op
  const aantalWoningen = e.aantalWoningen ?? await fetchAantalWoningen(e.wijk, e.stad)

  if (opts.dryRun) {
    process.stdout.write(`    DRY   ${slug} (${aantalWoningen ?? '?'} woningen)\n`)
    return 'ok' as const
  }

  // Genereer Gemini content
  const content = await generateContent(e, aantalWoningen)
  const jsonLd  = buildJsonLd(e, content, aantalWoningen)

  const { error } = await supabase.from('pseo_pages').upsert(
    {
      slug,
      provincie:           e.provincie,
      stad:                toSlug(e.stad),
      wijk:                toSlug(e.wijk),
      straat:              null,
      titel:               content.titel,
      meta_description:    content.metaDescription,
      hoofdtekst:          content.hoofdtekst,
      faq_items:           content.faqItems,
      json_ld:             jsonLd,
      gem_bouwjaar:        e.bouwjaar,
      gem_health_score:    score,
      netcongestie_status: e.netcongestie,
      aantal_woningen:     aantalWoningen,
      status:              'published',
      generated_at:        new Date().toISOString(),
      revalidate_at:       new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'slug' }
  )

  if (error) {
    process.stdout.write(`  FOUT  ${slug}: ${error.message}\n`)
    return 'error' as const
  }

  const wCount = aantalWoningen ? ` (${aantalWoningen.toLocaleString('nl-NL')} won.)` : ''
  process.stdout.write(`  ✓ ${slug}${wCount}\n`)
  return 'ok' as const
}

// ─── Wijk-lijst ─────────────────────────────────────────────────────────────
// Volgorde: hoog zoekvolume / grote bevolking eerst.
// Uitbreiden: voeg entries toe aan het einde van WIJKEN.
// CBS WFS haalt aantalWoningen automatisch op — geen handmatige invulling nodig.

const WIJKEN: WijkEntry[] = [
  // ── Utrecht ──────────────────────────────────────────────────────────────
  { wijk: 'Leidsche Rijn',       stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 2001, netcongestie: 'ORANJE' },
  { wijk: 'Vathorst',            stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 2002, netcongestie: 'ORANJE' },
  { wijk: 'Overvecht',           stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1966, netcongestie: 'ORANJE' },
  { wijk: 'Kanaleneiland',       stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1962, netcongestie: 'ORANJE' },
  { wijk: 'Lunetten',            stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Vleuten-De Meern',    stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 2000, netcongestie: 'ORANJE' },
  { wijk: 'Nieuwland',           stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 1990, netcongestie: 'ORANJE' },
  { wijk: 'Kattenbroek',         stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 1993, netcongestie: 'ORANJE' },
  { wijk: 'Hoogland-West',       stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 2002, netcongestie: 'ORANJE' },
  { wijk: 'Castellum',           stad: 'Houten',               provincie: 'utrecht',        bouwjaar: 2005, netcongestie: 'ORANJE' },
  { wijk: 'Jutphaas-Wijkersloot',stad: 'Nieuwegein',           provincie: 'utrecht',        bouwjaar: 1974, netcongestie: 'ORANJE' },
  { wijk: 'Batau-Noord',         stad: 'Nieuwegein',           provincie: 'utrecht',        bouwjaar: 1976, netcongestie: 'ORANJE' },
  { wijk: 'De Dragonder',        stad: 'Veenendaal',           provincie: 'utrecht',        bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Schrijverswijk',      stad: 'Veenendaal',           provincie: 'utrecht',        bouwjaar: 2000, netcongestie: 'GROEN'  },

  // ── Noord-Holland ─────────────────────────────────────────────────────────
  { wijk: 'IJburg',              stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 2004, netcongestie: 'ROOD'   },
  { wijk: 'Bijlmer-Centrum',     stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 2000, netcongestie: 'ROOD'   },
  { wijk: 'Bijlmer-Oost',        stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 2001, netcongestie: 'ROOD'   },
  { wijk: 'Gaasperdam',          stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1985, netcongestie: 'ROOD'   },
  { wijk: 'De Aker',             stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1997, netcongestie: 'ROOD'   },
  { wijk: 'Osdorp',              stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1965, netcongestie: 'ROOD'   },
  { wijk: 'Geuzenveld',          stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1960, netcongestie: 'ROOD'   },
  { wijk: 'Getsewoud',           stad: 'Haarlemmermeer',       provincie: 'noord-holland',  bouwjaar: 2002, netcongestie: 'ORANJE' },
  { wijk: 'Schalkwijk',          stad: 'Haarlem',              provincie: 'noord-holland',  bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Meerwijk',            stad: 'Haarlem',              provincie: 'noord-holland',  bouwjaar: 1967, netcongestie: 'ORANJE' },
  { wijk: 'Poelenburg',          stad: 'Zaandam',              provincie: 'noord-holland',  bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Kogerveld',           stad: 'Zaandam',              provincie: 'noord-holland',  bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Overdie',             stad: 'Alkmaar',              provincie: 'noord-holland',  bouwjaar: 1958, netcongestie: 'GROEN'  },
  { wijk: 'Vroonermeer',         stad: 'Alkmaar',              provincie: 'noord-holland',  bouwjaar: 1986, netcongestie: 'GROEN'  },
  { wijk: 'De Mare',             stad: 'Alkmaar',              provincie: 'noord-holland',  bouwjaar: 1997, netcongestie: 'GROEN'  },
  { wijk: 'Kersenboogerd',       stad: 'Hoorn',                provincie: 'noord-holland',  bouwjaar: 1988, netcongestie: 'GROEN'  },
  { wijk: 'Bangert-Oosterpolder',stad: 'Hoorn',                provincie: 'noord-holland',  bouwjaar: 2005, netcongestie: 'GROEN'  },
  { wijk: 'Wheermolen',          stad: 'Purmerend',            provincie: 'noord-holland',  bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Weidevenne',          stad: 'Purmerend',            provincie: 'noord-holland',  bouwjaar: 2001, netcongestie: 'ORANJE' },

  // ── Zuid-Holland ──────────────────────────────────────────────────────────
  { wijk: 'Ypenburg',            stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1999, netcongestie: 'ORANJE' },
  { wijk: 'Leidschenveen',       stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 2003, netcongestie: 'ORANJE' },
  { wijk: 'Escamp',              stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Morgenstond',         stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Moerwijk',            stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1952, netcongestie: 'ORANJE' },
  { wijk: 'Wateringse Veld',     stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1998, netcongestie: 'ORANJE' },
  { wijk: 'Prins Alexander',     stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ROOD'   },
  { wijk: 'Ommoord',             stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1972, netcongestie: 'ORANJE' },
  { wijk: 'Nesselande',          stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 2001, netcongestie: 'ORANJE' },
  { wijk: 'Beverwaard',          stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Pendrecht',           stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1953, netcongestie: 'GROEN'  },
  { wijk: 'Lombardijen',         stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Wilderszijde',        stad: 'Lansingerland',        provincie: 'zuid-holland',   bouwjaar: 2008, netcongestie: 'ORANJE' },
  { wijk: 'Stevenshof',          stad: 'Leiden',               provincie: 'zuid-holland',   bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Merenwijk',           stad: 'Leiden',               provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Meerburg',            stad: 'Leiden',               provincie: 'zuid-holland',   bouwjaar: 2006, netcongestie: 'ORANJE' },
  { wijk: 'Roomburg',            stad: 'Leiden',               provincie: 'zuid-holland',   bouwjaar: 2001, netcongestie: 'ORANJE' },
  { wijk: 'Oosterheem',          stad: 'Zoetermeer',           provincie: 'zuid-holland',   bouwjaar: 2004, netcongestie: 'ORANJE' },
  { wijk: 'Seghwaert',           stad: 'Zoetermeer',           provincie: 'zuid-holland',   bouwjaar: 1982, netcongestie: 'ORANJE' },
  { wijk: 'Meerzicht',           stad: 'Zoetermeer',           provincie: 'zuid-holland',   bouwjaar: 1984, netcongestie: 'ORANJE' },
  { wijk: 'Rokkeveen',           stad: 'Zoetermeer',           provincie: 'zuid-holland',   bouwjaar: 1990, netcongestie: 'ORANJE' },
  { wijk: 'Stadswerven',         stad: 'Dordrecht',            provincie: 'zuid-holland',   bouwjaar: 2015, netcongestie: 'ROOD'   },
  { wijk: 'Krispijn',            stad: 'Dordrecht',            provincie: 'zuid-holland',   bouwjaar: 1945, netcongestie: 'ORANJE' },
  { wijk: 'Wielwijk',            stad: 'Dordrecht',            provincie: 'zuid-holland',   bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Sterrenburg',         stad: 'Dordrecht',            provincie: 'zuid-holland',   bouwjaar: 1973, netcongestie: 'ORANJE' },
  { wijk: 'Tanthof',             stad: 'Delft',                provincie: 'zuid-holland',   bouwjaar: 1981, netcongestie: 'ORANJE' },
  { wijk: 'Voorhof',             stad: 'Delft',                provincie: 'zuid-holland',   bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Hof van Delft',       stad: 'Delft',                provincie: 'zuid-holland',   bouwjaar: 2004, netcongestie: 'ORANJE' },
  { wijk: 'Groenoord',           stad: 'Schiedam',             provincie: 'zuid-holland',   bouwjaar: 1969, netcongestie: 'ORANJE' },
  { wijk: 'Woudhoek',            stad: 'Schiedam',             provincie: 'zuid-holland',   bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Holy-Noord',          stad: 'Vlaardingen',          provincie: 'zuid-holland',   bouwjaar: 1967, netcongestie: 'ORANJE' },
  { wijk: 'Westwijk',            stad: 'Vlaardingen',          provincie: 'zuid-holland',   bouwjaar: 1972, netcongestie: 'ORANJE' },
  { wijk: 'Middelwatering',      stad: 'Capelle aan den IJssel',provincie: 'zuid-holland',  bouwjaar: 1972, netcongestie: 'ORANJE' },
  { wijk: 'Oostgaarde',          stad: 'Capelle aan den IJssel',provincie: 'zuid-holland',  bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Waterland',           stad: 'Nissewaard',           provincie: 'zuid-holland',   bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Maaswijk',            stad: 'Nissewaard',           provincie: 'zuid-holland',   bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Goverwelle',          stad: 'Gouda',                provincie: 'zuid-holland',   bouwjaar: 1995, netcongestie: 'GROEN'  },
  { wijk: 'Bloemendaal',         stad: 'Gouda',                provincie: 'zuid-holland',   bouwjaar: 1972, netcongestie: 'GROEN'  },
  { wijk: 'Ridderveld',          stad: 'Alphen aan den Rijn',  provincie: 'zuid-holland',   bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Zwammerdam',          stad: 'Alphen aan den Rijn',  provincie: 'zuid-holland',   bouwjaar: 2001, netcongestie: 'GROEN'  },

  // ── Noord-Brabant ─────────────────────────────────────────────────────────
  { wijk: 'Reeshof',             stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'Groenewoud',          stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Stokhasselt',         stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Berkel-Enschot',      stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Haagse Beemden',      stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1988, netcongestie: 'GROEN'  },
  { wijk: 'Hoge Vugt',           stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'Tuinzigt',            stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Bavel',               stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Brandevoort',         stad: 'Helmond',              provincie: 'noord-brabant',  bouwjaar: 2003, netcongestie: 'ORANJE' },
  { wijk: 'Rijpelberg',          stad: 'Helmond',              provincie: 'noord-brabant',  bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Mierlo-Hout',         stad: 'Helmond',              provincie: 'noord-brabant',  bouwjaar: 1972, netcongestie: 'GROEN'  },
  { wijk: 'Meerhoven',           stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 2004, netcongestie: 'ORANJE' },
  { wijk: 'Woensel-Noord',       stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Woensel-West',        stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Tongelre',            stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'Gestel',              stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 1948, netcongestie: 'GROEN'  },
  { wijk: 'De Markiezaten',      stad: 'Bergen op Zoom',       provincie: 'noord-brabant',  bouwjaar: 2005, netcongestie: 'GROEN'  },
  { wijk: 'Gageldonk-West',      stad: 'Bergen op Zoom',       provincie: 'noord-brabant',  bouwjaar: 2002, netcongestie: 'GROEN'  },
  { wijk: 'Maaspoort',           stad: 's-Hertogenbosch',      provincie: 'noord-brabant',  bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'De Vliert',           stad: 's-Hertogenbosch',      provincie: 'noord-brabant',  bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Rosmalen-Noord',      stad: 's-Hertogenbosch',      provincie: 'noord-brabant',  bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Empel',               stad: 's-Hertogenbosch',      provincie: 'noord-brabant',  bouwjaar: 2002, netcongestie: 'ORANJE' },
  { wijk: 'Kortendijk',          stad: 'Roosendaal',           provincie: 'noord-brabant',  bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Westrand',            stad: 'Roosendaal',           provincie: 'noord-brabant',  bouwjaar: 1985, netcongestie: 'GROEN'  },

  // ── Gelderland ───────────────────────────────────────────────────────────
  { wijk: 'Waalsprong',          stad: 'Nijmegen',             provincie: 'gelderland',     bouwjaar: 2004, netcongestie: 'ORANJE' },
  { wijk: 'Dukenburg',           stad: 'Nijmegen',             provincie: 'gelderland',     bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Lindenholt',          stad: 'Nijmegen',             provincie: 'gelderland',     bouwjaar: 1979, netcongestie: 'ORANJE' },
  { wijk: 'Hatert',              stad: 'Nijmegen',             provincie: 'gelderland',     bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Neerbosch-Oost',      stad: 'Nijmegen',             provincie: 'gelderland',     bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Schuytgraaf',         stad: 'Arnhem',               provincie: 'gelderland',     bouwjaar: 2005, netcongestie: 'ORANJE' },
  { wijk: 'Presikhaaf',          stad: 'Arnhem',               provincie: 'gelderland',     bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Kronenburg',          stad: 'Arnhem',               provincie: 'gelderland',     bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Malburgen',           stad: 'Arnhem',               provincie: 'gelderland',     bouwjaar: 1951, netcongestie: 'ORANJE' },
  { wijk: 'Zuidbroek',           stad: 'Apeldoorn',            provincie: 'gelderland',     bouwjaar: 2006, netcongestie: 'GROEN'  },
  { wijk: 'Matenbuurt',          stad: 'Apeldoorn',            provincie: 'gelderland',     bouwjaar: 1973, netcongestie: 'GROEN'  },
  { wijk: 'Zevenhuizen',         stad: 'Apeldoorn',            provincie: 'gelderland',     bouwjaar: 1977, netcongestie: 'GROEN'  },
  { wijk: 'Osseveld',            stad: 'Apeldoorn',            provincie: 'gelderland',     bouwjaar: 1988, netcongestie: 'GROEN'  },
  { wijk: 'Doornsteeg',          stad: 'Nijkerk',              provincie: 'gelderland',     bouwjaar: 2001, netcongestie: 'GROEN'  },
  { wijk: 'Groenenstein',        stad: 'Barneveld',            provincie: 'gelderland',     bouwjaar: 2000, netcongestie: 'GROEN'  },
  { wijk: 'De Valk',             stad: 'Ede',                  provincie: 'gelderland',     bouwjaar: 1995, netcongestie: 'GROEN'  },
  { wijk: 'Veldhuizen',          stad: 'Ede',                  provincie: 'gelderland',     bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Tarthorst',           stad: 'Wageningen',           provincie: 'gelderland',     bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Passewaaij',          stad: 'Tiel',                 provincie: 'gelderland',     bouwjaar: 1997, netcongestie: 'GROEN'  },
  { wijk: 'De Hoven',            stad: 'Zutphen',              provincie: 'gelderland',     bouwjaar: 1969, netcongestie: 'GROEN'  },
  { wijk: 'De Huet',             stad: 'Doetinchem',           provincie: 'gelderland',     bouwjaar: 1975, netcongestie: 'GROEN'  },

  // ── Overijssel ───────────────────────────────────────────────────────────
  { wijk: 'Stadshagen',          stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 1998, netcongestie: 'ORANJE' },
  { wijk: 'Berkum',              stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 2004, netcongestie: 'ORANJE' },
  { wijk: 'Holtenbroek',         stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Aa-landen',           stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Westenholte',         stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 2005, netcongestie: 'ORANJE' },
  { wijk: 'Wesselerbrink',       stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Stroinkslanden',      stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Velve-Lindenhof',     stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'Deppenbroek',         stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Pathmos',             stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 1958, netcongestie: 'GROEN'  },
  { wijk: 'Colmschate',          stad: 'Deventer',             provincie: 'overijssel',     bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Keizerslanden',       stad: 'Deventer',             provincie: 'overijssel',     bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Schalkhaar',          stad: 'Deventer',             provincie: 'overijssel',     bouwjaar: 1990, netcongestie: 'GROEN'  },

  // ── Flevoland ─────────────────────────────────────────────────────────────
  { wijk: 'Nobelhorst',          stad: 'Almere',               provincie: 'flevoland',      bouwjaar: 2009, netcongestie: 'GROEN'  },
  { wijk: 'Poort',               stad: 'Almere',               provincie: 'flevoland',      bouwjaar: 2005, netcongestie: 'GROEN'  },
  { wijk: 'Almere Buiten-Centrum',stad: 'Almere',              provincie: 'flevoland',      bouwjaar: 1987, netcongestie: 'GROEN'  },
  { wijk: 'Filmwijk',            stad: 'Almere',               provincie: 'flevoland',      bouwjaar: 1988, netcongestie: 'GROEN'  },
  { wijk: 'Literatuurwijk',      stad: 'Almere',               provincie: 'flevoland',      bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'De Wierden',          stad: 'Almere',               provincie: 'flevoland',      bouwjaar: 1998, netcongestie: 'GROEN'  },
  { wijk: 'Boswijk',             stad: 'Lelystad',             provincie: 'flevoland',      bouwjaar: 1996, netcongestie: 'GROEN'  },
  { wijk: 'Warande',             stad: 'Lelystad',             provincie: 'flevoland',      bouwjaar: 2000, netcongestie: 'GROEN'  },
  { wijk: 'Zuiderzeewijk',       stad: 'Lelystad',             provincie: 'flevoland',      bouwjaar: 2003, netcongestie: 'GROEN'  },

  // ── Groningen ─────────────────────────────────────────────────────────────
  { wijk: 'Meerstad',            stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 2010, netcongestie: 'GROEN'  },
  { wijk: 'Selwerd',             stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'Paddepoel',           stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Lewenborg',           stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Vinkhuizen',          stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Corpus den Hoorn',    stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Gravenburg',          stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Hoogkerk',            stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1975, netcongestie: 'GROEN'  },

  // ── Friesland ─────────────────────────────────────────────────────────────
  { wijk: 'Skoatterwâld',        stad: 'Heerenveen',           provincie: 'friesland',      bouwjaar: 2005, netcongestie: 'GROEN'  },
  { wijk: 'Zuiderburen',         stad: 'Leeuwarden',           provincie: 'friesland',      bouwjaar: 2008, netcongestie: 'GROEN'  },
  { wijk: 'Camminghaburen',      stad: 'Leeuwarden',           provincie: 'friesland',      bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'De Vlietlanden',      stad: 'Leeuwarden',           provincie: 'friesland',      bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Wielenpoel',          stad: 'Leeuwarden',           provincie: 'friesland',      bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Heechterp',           stad: 'Leeuwarden',           provincie: 'friesland',      bouwjaar: 1969, netcongestie: 'GROEN'  },

  // ── Drenthe ───────────────────────────────────────────────────────────────
  { wijk: 'Kloosterveen',        stad: 'Assen',                provincie: 'drenthe',        bouwjaar: 2002, netcongestie: 'GROEN'  },
  { wijk: 'Pittelo',             stad: 'Assen',                provincie: 'drenthe',        bouwjaar: 1972, netcongestie: 'GROEN'  },
  { wijk: 'Peelo',               stad: 'Assen',                provincie: 'drenthe',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Marsdijk',            stad: 'Assen',                provincie: 'drenthe',        bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Emmerhout',           stad: 'Emmen',                provincie: 'drenthe',        bouwjaar: 1966, netcongestie: 'GROEN'  },
  { wijk: 'Bargeres',            stad: 'Emmen',                provincie: 'drenthe',        bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Angelslo',            stad: 'Emmen',                provincie: 'drenthe',        bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Rietlanden',          stad: 'Meppel',               provincie: 'drenthe',        bouwjaar: 1998, netcongestie: 'GROEN'  },

  // ── Limburg ───────────────────────────────────────────────────────────────
  { wijk: 'Nazareth',            stad: 'Maastricht',           provincie: 'limburg',        bouwjaar: 1963, netcongestie: 'ORANJE' },
  { wijk: 'Malberg',             stad: 'Maastricht',           provincie: 'limburg',        bouwjaar: 1969, netcongestie: 'ORANJE' },
  { wijk: 'Wittevrouwenveld',    stad: 'Maastricht',           provincie: 'limburg',        bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Meezenbroek',         stad: 'Heerlen',              provincie: 'limburg',        bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Heerlerbaan',         stad: 'Heerlen',              provincie: 'limburg',        bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Born',                stad: 'Sittard-Geleen',       provincie: 'limburg',        bouwjaar: 1975, netcongestie: 'GROEN'  },

  // ── Zeeland ───────────────────────────────────────────────────────────────
  { wijk: 'Dauwendaele',         stad: 'Middelburg',           provincie: 'zeeland',        bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Stromenwijk',         stad: 'Middelburg',           provincie: 'zeeland',        bouwjaar: 1995, netcongestie: 'GROEN'  },
  { wijk: 'Dauwendaele-Noord',   stad: 'Middelburg',           provincie: 'zeeland',        bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'De Goese Meer',       stad: 'Goes',                 provincie: 'zeeland',        bouwjaar: 2005, netcongestie: 'GROEN'  },

  // ── Utrecht (uitbreiding) ────────────────────────────────────────────────
  { wijk: 'Zuilen',              stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Lombok',              stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1910, netcongestie: 'ORANJE' },
  { wijk: 'Ondiep',              stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1948, netcongestie: 'ORANJE' },
  { wijk: 'Hoograven',          stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1952, netcongestie: 'ORANJE' },
  { wijk: 'Rivierenwijk',        stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1928, netcongestie: 'ORANJE' },
  { wijk: 'Wittevrouwen',        stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1920, netcongestie: 'ORANJE' },
  { wijk: 'Rijnsweerd',          stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'De Uithof',           stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Tuindorp',            stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1925, netcongestie: 'ORANJE' },
  { wijk: 'Transwijk',           stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1972, netcongestie: 'ORANJE' },
  { wijk: 'Oog in Al',           stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1930, netcongestie: 'ORANJE' },
  { wijk: 'Parkwijk',            stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Vleuterweide',        stad: 'Utrecht',              provincie: 'utrecht',        bouwjaar: 2008, netcongestie: 'ORANJE' },
  { wijk: 'Pijnenburg',          stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Liendert',            stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Randenbroek',         stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Schothorst',          stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Kruiskamp',           stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 1952, netcongestie: 'ORANJE' },
  { wijk: 'Soesterkwartier',     stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 1957, netcongestie: 'ORANJE' },
  { wijk: 'Calveen',             stad: 'Amersfoort',           provincie: 'utrecht',        bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Koninginnelaan',      stad: 'Houten',               provincie: 'utrecht',        bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Houten-Noord',        stad: 'Houten',               provincie: 'utrecht',        bouwjaar: 2003, netcongestie: 'ORANJE' },
  { wijk: 'Houten-Zuid',         stad: 'Houten',               provincie: 'utrecht',        bouwjaar: 2006, netcongestie: 'ORANJE' },
  { wijk: 'Batau-Zuid',          stad: 'Nieuwegein',           provincie: 'utrecht',        bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Lekboulevard',        stad: 'Nieuwegein',           provincie: 'utrecht',        bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Merwestein',          stad: 'Nieuwegein',           provincie: 'utrecht',        bouwjaar: 1993, netcongestie: 'ORANJE' },
  { wijk: 'Galecop',             stad: 'Nieuwegein',           provincie: 'utrecht',        bouwjaar: 1999, netcongestie: 'ORANJE' },
  { wijk: 'Fokkesteeg',          stad: 'Veenendaal',           provincie: 'utrecht',        bouwjaar: 1955, netcongestie: 'GROEN'  },
  { wijk: 'Dragonder-Noord',     stad: 'Veenendaal',           provincie: 'utrecht',        bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'Veenendaal-Oost',     stad: 'Veenendaal',           provincie: 'utrecht',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Maarssenbroek',       stad: 'Maarssen',             provincie: 'utrecht',        bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Zeist-West',          stad: 'Zeist',                provincie: 'utrecht',        bouwjaar: 1963, netcongestie: 'ORANJE' },
  { wijk: 'Zeist-Noord',         stad: 'Zeist',                provincie: 'utrecht',        bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'De Bilt-Noord',       stad: 'De Bilt',              provincie: 'utrecht',        bouwjaar: 1972, netcongestie: 'GROEN'  },
  { wijk: 'Bilthoven-Noord',     stad: 'De Bilt',              provincie: 'utrecht',        bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'IJsselstein-Noord',   stad: 'IJsselstein',          provincie: 'utrecht',        bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Lopik',               stad: 'Lopik',                provincie: 'utrecht',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Woerden-Noord',       stad: 'Woerden',              provincie: 'utrecht',        bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Woerden-West',        stad: 'Woerden',              provincie: 'utrecht',        bouwjaar: 1990, netcongestie: 'ORANJE' },
  { wijk: 'Stichtse Vecht-Noord',stad: 'Stichtse Vecht',       provincie: 'utrecht',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Bunnik',              stad: 'Bunnik',               provincie: 'utrecht',        bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Wijk bij Duurstede',  stad: 'Wijk bij Duurstede',   provincie: 'utrecht',        bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Culemborg-Oost',      stad: 'Culemborg',            provincie: 'utrecht',        bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Rhenen-Noord',        stad: 'Rhenen',               provincie: 'utrecht',        bouwjaar: 1975, netcongestie: 'GROEN'  },

  // ── Noord-Holland (uitbreiding) ──────────────────────────────────────────
  { wijk: 'Slotermeer',          stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1958, netcongestie: 'ROOD'   },
  { wijk: 'Slotervaart',         stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1960, netcongestie: 'ROOD'   },
  { wijk: 'Bos en Lommer',       stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1935, netcongestie: 'ROOD'   },
  { wijk: 'De Baarsjes',         stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1910, netcongestie: 'ROOD'   },
  { wijk: 'Noord-Oost',          stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1975, netcongestie: 'ROOD'   },
  { wijk: 'Buikslotermeer',      stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1965, netcongestie: 'ROOD'   },
  { wijk: 'Nieuwendam',          stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1960, netcongestie: 'ROOD'   },
  { wijk: 'Watergraafsmeer',     stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1930, netcongestie: 'ROOD'   },
  { wijk: 'Indische Buurt',      stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1915, netcongestie: 'ROOD'   },
  { wijk: 'Landlust',            stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1930, netcongestie: 'ROOD'   },
  { wijk: 'Overtoomse Veld',     stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1955, netcongestie: 'ROOD'   },
  { wijk: 'Rivierenbuurt',       stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1928, netcongestie: 'ROOD'   },
  { wijk: 'De Pijp',             stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1905, netcongestie: 'ROOD'   },
  { wijk: 'Oud-West',            stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1895, netcongestie: 'ROOD'   },
  { wijk: 'Nieuw-West',          stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1960, netcongestie: 'ROOD'   },
  { wijk: 'Holendrecht',         stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1973, netcongestie: 'ROOD'   },
  { wijk: 'Driemond',            stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1978, netcongestie: 'ROOD'   },
  { wijk: 'Tuindorp Nieuwendam', stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 1927, netcongestie: 'ROOD'   },
  { wijk: 'Parkstad',            stad: 'Amsterdam',            provincie: 'noord-holland',  bouwjaar: 2005, netcongestie: 'ROOD'   },
  { wijk: 'Floriande',           stad: 'Haarlemmermeer',       provincie: 'noord-holland',  bouwjaar: 2000, netcongestie: 'ORANJE' },
  { wijk: 'Toolenburg',          stad: 'Haarlemmermeer',       provincie: 'noord-holland',  bouwjaar: 1990, netcongestie: 'ORANJE' },
  { wijk: 'Badhoevedorp',        stad: 'Haarlemmermeer',       provincie: 'noord-holland',  bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Zwanenburg',          stad: 'Haarlemmermeer',       provincie: 'noord-holland',  bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Pionier',             stad: 'Haarlemmermeer',       provincie: 'noord-holland',  bouwjaar: 2008, netcongestie: 'ORANJE' },
  { wijk: 'Schalkwijkse Meer',   stad: 'Haarlem',              provincie: 'noord-holland',  bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Boerhaavewijk',       stad: 'Haarlem',              provincie: 'noord-holland',  bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Slachthuisbuurt',     stad: 'Haarlem',              provincie: 'noord-holland',  bouwjaar: 1890, netcongestie: 'ORANJE' },
  { wijk: 'Delftwijk',           stad: 'Haarlem',              provincie: 'noord-holland',  bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Parkwijk-Haarlem',    stad: 'Haarlem',              provincie: 'noord-holland',  bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Wijk aan Zee',        stad: 'Beverwijk',            provincie: 'noord-holland',  bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Meerplein',           stad: 'Zaandam',              provincie: 'noord-holland',  bouwjaar: 1993, netcongestie: 'ORANJE' },
  { wijk: 'Peldersveld',         stad: 'Zaandam',              provincie: 'noord-holland',  bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Rosmolenbuurt',       stad: 'Zaandam',              provincie: 'noord-holland',  bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Zaandam-Oost',        stad: 'Zaandam',              provincie: 'noord-holland',  bouwjaar: 1935, netcongestie: 'ORANJE' },
  { wijk: 'Alkmaar-Noord',       stad: 'Alkmaar',              provincie: 'noord-holland',  bouwjaar: 1962, netcongestie: 'GROEN'  },
  { wijk: 'Alkmaar-Oost',        stad: 'Alkmaar',              provincie: 'noord-holland',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Alkmaar-West',        stad: 'Alkmaar',              provincie: 'noord-holland',  bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Driehuizen',          stad: 'Hoorn',                provincie: 'noord-holland',  bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Hoorn-Noord',         stad: 'Hoorn',                provincie: 'noord-holland',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Zwaag',               stad: 'Hoorn',                provincie: 'noord-holland',  bouwjaar: 1988, netcongestie: 'GROEN'  },
  { wijk: 'Wheermolen-West',     stad: 'Purmerend',            provincie: 'noord-holland',  bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Purmerend-Noord',     stad: 'Purmerend',            provincie: 'noord-holland',  bouwjaar: 2002, netcongestie: 'ORANJE' },
  { wijk: 'Gors',                stad: 'Purmerend',            provincie: 'noord-holland',  bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Almere Buiten',       stad: 'Almere',               provincie: 'flevoland',      bouwjaar: 1996, netcongestie: 'ORANJE' },
  { wijk: 'Almere Poort',        stad: 'Almere',               provincie: 'flevoland',      bouwjaar: 2003, netcongestie: 'ORANJE' },
  { wijk: 'Almere Hout-Noord',   stad: 'Almere',               provincie: 'flevoland',      bouwjaar: 2012, netcongestie: 'ORANJE' },
  { wijk: 'Almere Haven',        stad: 'Almere',               provincie: 'flevoland',      bouwjaar: 1977, netcongestie: 'ORANJE' },
  { wijk: 'Almere Muziekwijk',   stad: 'Almere',               provincie: 'flevoland',      bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Almere Literatuurwijk',stad: 'Almere',              provincie: 'flevoland',      bouwjaar: 1990, netcongestie: 'ORANJE' },
  { wijk: 'Lelystad-Noord',      stad: 'Lelystad',             provincie: 'flevoland',      bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Lelystad-Oost',       stad: 'Lelystad',             provincie: 'flevoland',      bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Boswijk',             stad: 'Lelystad',             provincie: 'flevoland',      bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'Atolwijk',            stad: 'Lelystad',             provincie: 'flevoland',      bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Emmeloord-Noord',     stad: 'Emmeloord',            provincie: 'flevoland',      bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Nagele',              stad: 'Noordoostpolder',      provincie: 'flevoland',      bouwjaar: 1956, netcongestie: 'GROEN'  },
  { wijk: 'Urk-Oost',            stad: 'Urk',                  provincie: 'flevoland',      bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Zeewolde-Dorp',       stad: 'Zeewolde',             provincie: 'flevoland',      bouwjaar: 1988, netcongestie: 'GROEN'  },

  // ── Zuid-Holland (uitbreiding) ───────────────────────────────────────────
  { wijk: 'Spijkenisse-Noord',   stad: 'Nissewaard',           provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Spijkenisse-Oost',    stad: 'Nissewaard',           provincie: 'zuid-holland',   bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Hellevoetsluis-Noord',stad: 'Hellevoetsluis',       provincie: 'zuid-holland',   bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Barendrecht-Carnisselande',stad: 'Barendrecht',     provincie: 'zuid-holland',   bouwjaar: 2000, netcongestie: 'ORANJE' },
  { wijk: 'Barendrecht-Oost',    stad: 'Barendrecht',          provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Ridderkerk-Noord',    stad: 'Ridderkerk',           provincie: 'zuid-holland',   bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Ridderkerk-Oost',     stad: 'Ridderkerk',           provincie: 'zuid-holland',   bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Capelle Fascinatio',  stad: 'Capelle aan den IJssel',provincie: 'zuid-holland',  bouwjaar: 2001, netcongestie: 'ORANJE' },
  { wijk: 'Capelle Schenkel',    stad: 'Capelle aan den IJssel',provincie: 'zuid-holland',  bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Capelle Middelwatering',stad:'Capelle aan den IJssel',provincie: 'zuid-holland', bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Krimpen Langeland',   stad: 'Krimpen aan den IJssel',provincie: 'zuid-holland',  bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Schiedam-Oost',       stad: 'Schiedam',             provincie: 'zuid-holland',   bouwjaar: 1953, netcongestie: 'ORANJE' },
  { wijk: 'Schiedam-Noord',      stad: 'Schiedam',             provincie: 'zuid-holland',   bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Vlaardingerambacht',  stad: 'Vlaardingen',          provincie: 'zuid-holland',   bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Babberspolder',       stad: 'Vlaardingen',          provincie: 'zuid-holland',   bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Maassluis-West',      stad: 'Maassluis',            provincie: 'zuid-holland',   bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Maassluis-Oost',      stad: 'Maassluis',            provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Spaanse Polder',      stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Zuidwijk',            stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Groot-IJsselmonde',   stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Hoogvliet',           stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1957, netcongestie: 'ORANJE' },
  { wijk: 'Heijplaat',           stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1916, netcongestie: 'ORANJE' },
  { wijk: 'Kralingen',           stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1905, netcongestie: 'ORANJE' },
  { wijk: 'Hillegersberg',       stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1930, netcongestie: 'ORANJE' },
  { wijk: 'Overschie',           stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Delfshaven',          stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1898, netcongestie: 'ORANJE' },
  { wijk: 'Feijenoord',          stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1925, netcongestie: 'ORANJE' },
  { wijk: 'Charlois',            stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1950, netcongestie: 'ORANJE' },
  { wijk: 'Rotterdam-Noord',     stad: 'Rotterdam',            provincie: 'zuid-holland',   bouwjaar: 1900, netcongestie: 'ORANJE' },
  { wijk: 'Bergschenhoek',       stad: 'Lansingerland',        provincie: 'zuid-holland',   bouwjaar: 1988, netcongestie: 'ORANJE' },
  { wijk: 'Berkel en Rodenrijs', stad: 'Lansingerland',        provincie: 'zuid-holland',   bouwjaar: 1992, netcongestie: 'ORANJE' },
  { wijk: 'Bleiswijk',           stad: 'Lansingerland',        provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Leiden-Noord',        stad: 'Leiden',               provincie: 'zuid-holland',   bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Leiden-Oost',         stad: 'Leiden',               provincie: 'zuid-holland',   bouwjaar: 1935, netcongestie: 'ORANJE' },
  { wijk: 'Leiden-West',         stad: 'Leiden',               provincie: 'zuid-holland',   bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Leiden-Boerhaavewijk',stad: 'Leiden',               provincie: 'zuid-holland',   bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Voorschoten-Noord',   stad: 'Voorschoten',          provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Wassenaar-Oost',      stad: 'Wassenaar',            provincie: 'zuid-holland',   bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'Rijswijk-Noord',      stad: 'Rijswijk',             provincie: 'zuid-holland',   bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Rijswijk-West',       stad: 'Rijswijk',             provincie: 'zuid-holland',   bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Delft-Noord',         stad: 'Delft',                provincie: 'zuid-holland',   bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Delft-Oost',          stad: 'Delft',                provincie: 'zuid-holland',   bouwjaar: 1948, netcongestie: 'ORANJE' },
  { wijk: 'Tanthof',             stad: 'Delft',                provincie: 'zuid-holland',   bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Buitenhof',           stad: 'Delft',                provincie: 'zuid-holland',   bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Den Haag Laakkwartier',stad: 'Den Haag',            provincie: 'zuid-holland',   bouwjaar: 1915, netcongestie: 'ORANJE' },
  { wijk: 'Centrum Den Haag',    stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1890, netcongestie: 'ORANJE' },
  { wijk: 'Bezuidenhout',        stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1912, netcongestie: 'ORANJE' },
  { wijk: 'Mariahoeve',          stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Moerwijk',            stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1950, netcongestie: 'ORANJE' },
  { wijk: 'Bouwlust',            stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Vrederust',           stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1962, netcongestie: 'ORANJE' },
  { wijk: 'Leyenburg',           stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Velddeel',            stad: 'Den Haag',             provincie: 'zuid-holland',   bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Goudswaard',          stad: 'Dordrecht',            provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Dordrecht-Noord',     stad: 'Dordrecht',            provincie: 'zuid-holland',   bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Wielwijk',            stad: 'Dordrecht',            provincie: 'zuid-holland',   bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Crabbehof',           stad: 'Dordrecht',            provincie: 'zuid-holland',   bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Sterrenburg',         stad: 'Dordrecht',            provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Dordrecht-Oost',      stad: 'Dordrecht',            provincie: 'zuid-holland',   bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Gouda-Oost',          stad: 'Gouda',                provincie: 'zuid-holland',   bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Gouda-Noord',         stad: 'Gouda',                provincie: 'zuid-holland',   bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Gouda-West',          stad: 'Gouda',                provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Moordrecht',          stad: 'Waddinxveen',          provincie: 'zuid-holland',   bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Alphen-Noord',        stad: 'Alphen aan den Rijn',  provincie: 'zuid-holland',   bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Alphen-Oost',         stad: 'Alphen aan den Rijn',  provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Boskoop',             stad: 'Alphen aan den Rijn',  provincie: 'zuid-holland',   bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Zoetermeer-Centrum',  stad: 'Zoetermeer',           provincie: 'zuid-holland',   bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Rokkeveen',           stad: 'Zoetermeer',           provincie: 'zuid-holland',   bouwjaar: 1982, netcongestie: 'ORANJE' },
  { wijk: 'Seghwaert',           stad: 'Zoetermeer',           provincie: 'zuid-holland',   bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Meerzicht',           stad: 'Zoetermeer',           provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Palenstein',          stad: 'Zoetermeer',           provincie: 'zuid-holland',   bouwjaar: 1972, netcongestie: 'ORANJE' },
  { wijk: 'Driemanspolder',      stad: 'Zoetermeer',           provincie: 'zuid-holland',   bouwjaar: 1998, netcongestie: 'ORANJE' },

  // ── Noord-Brabant (uitbreiding) ──────────────────────────────────────────
  { wijk: 'Eindhoven Woensel',   stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Eindhoven Stratum',   stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 1930, netcongestie: 'ORANJE' },
  { wijk: 'Eindhoven Strijp',    stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 1925, netcongestie: 'ORANJE' },
  { wijk: 'Tongelre',            stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Gestel',              stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Eindhoven Centrum',   stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 1898, netcongestie: 'ORANJE' },
  { wijk: 'Veldhoven-Noord',     stad: 'Veldhoven',            provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Meerhoven',           stad: 'Eindhoven',            provincie: 'noord-brabant',  bouwjaar: 2002, netcongestie: 'ORANJE' },
  { wijk: 'Geldrop-Centrum',     stad: 'Geldrop-Mierlo',       provincie: 'noord-brabant',  bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Nuenen-West',         stad: 'Nuenen',               provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Tilburg-Noord',       stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Tilburg-Centrum',     stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1910, netcongestie: 'ORANJE' },
  { wijk: 'Tilburg-Oost',        stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Tilburg-West',        stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Reeshof',             stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1990, netcongestie: 'ORANJE' },
  { wijk: 'Groenewoud',          stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Loven',               stad: 'Tilburg',              provincie: 'noord-brabant',  bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Breda-Centrum',       stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1890, netcongestie: 'ORANJE' },
  { wijk: 'Breda-West',          stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Breda-Oost',          stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Haagse Beemden',      stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Prinsenbeek',         stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Bavel',               stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Ulvenhout',           stad: 'Breda',                provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Den Bosch-Noord',     stad: 'Den Bosch',            provincie: 'noord-brabant',  bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Den Bosch-Oost',      stad: 'Den Bosch',            provincie: 'noord-brabant',  bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Maaspoort',           stad: 'Den Bosch',            provincie: 'noord-brabant',  bouwjaar: 1995, netcongestie: 'ORANJE' },
  { wijk: 'Rosmalen',            stad: 'Den Bosch',            provincie: 'noord-brabant',  bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Oss-West',            stad: 'Oss',                  provincie: 'noord-brabant',  bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Oss-Noord',           stad: 'Oss',                  provincie: 'noord-brabant',  bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Berghem',             stad: 'Oss',                  provincie: 'noord-brabant',  bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Helmond-Oost',        stad: 'Helmond',              provincie: 'noord-brabant',  bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Helmond-West',        stad: 'Helmond',              provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Brandevoort',         stad: 'Helmond',              provincie: 'noord-brabant',  bouwjaar: 2000, netcongestie: 'ORANJE' },
  { wijk: 'Brouwhuis',           stad: 'Helmond',              provincie: 'noord-brabant',  bouwjaar: 1977, netcongestie: 'ORANJE' },
  { wijk: 'Roosendaal-Noord',    stad: 'Roosendaal',           provincie: 'noord-brabant',  bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Bergen op Zoom-Oost', stad: 'Bergen op Zoom',       provincie: 'noord-brabant',  bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Borgvliet',           stad: 'Bergen op Zoom',       provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Ekeren',              stad: 'Bergen op Zoom',       provincie: 'noord-brabant',  bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Woensdrecht',         stad: 'Woensdrecht',          provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Valkenswaard-Noord',  stad: 'Valkenswaard',         provincie: 'noord-brabant',  bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Eersel',              stad: 'Eersel',               provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'GROEN'  },

  // ── Gelderland (uitbreiding) ─────────────────────────────────────────────
  { wijk: 'Arnhem-Noord',        stad: 'Arnhem',               provincie: 'gelderland',     bouwjaar: 1956, netcongestie: 'ORANJE' },
  { wijk: 'Presikhaaf',          stad: 'Arnhem',               provincie: 'gelderland',     bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Elden',               stad: 'Arnhem',               provincie: 'gelderland',     bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Schuytgraaf',         stad: 'Arnhem',               provincie: 'gelderland',     bouwjaar: 2005, netcongestie: 'ORANJE' },
  { wijk: 'Malburgen',           stad: 'Arnhem',               provincie: 'gelderland',     bouwjaar: 1963, netcongestie: 'ORANJE' },
  { wijk: 'Kronenburg',          stad: 'Arnhem',               provincie: 'gelderland',     bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Nijmegen-Oost',       stad: 'Nijmegen',             provincie: 'gelderland',     bouwjaar: 1925, netcongestie: 'ORANJE' },
  { wijk: 'Nijmegen-Noord',      stad: 'Nijmegen',             provincie: 'gelderland',     bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Nijmegen-West',       stad: 'Nijmegen',             provincie: 'gelderland',     bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Hees',                stad: 'Nijmegen',             provincie: 'gelderland',     bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Neerbosch-Oost',      stad: 'Nijmegen',             provincie: 'gelderland',     bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Apeldoorn-Noord',     stad: 'Apeldoorn',            provincie: 'gelderland',     bouwjaar: 1958, netcongestie: 'GROEN'  },
  { wijk: 'Apeldoorn-Oost',      stad: 'Apeldoorn',            provincie: 'gelderland',     bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Apeldoorn-West',      stad: 'Apeldoorn',            provincie: 'gelderland',     bouwjaar: 1973, netcongestie: 'GROEN'  },
  { wijk: 'Apeldoorn-Zuid',      stad: 'Apeldoorn',            provincie: 'gelderland',     bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'De Maten',            stad: 'Apeldoorn',            provincie: 'gelderland',     bouwjaar: 1972, netcongestie: 'GROEN'  },
  { wijk: 'Ede-West',            stad: 'Ede',                  provincie: 'gelderland',     bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Ede-Noord',           stad: 'Ede',                  provincie: 'gelderland',     bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Veldhuizen',          stad: 'Ede',                  provincie: 'gelderland',     bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Lunteren',            stad: 'Ede',                  provincie: 'gelderland',     bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Nijkerk-Noord',       stad: 'Nijkerk',              provincie: 'gelderland',     bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Nijkerk-West',        stad: 'Nijkerk',              provincie: 'gelderland',     bouwjaar: 1988, netcongestie: 'ORANJE' },
  { wijk: 'Tiel-Noord',          stad: 'Tiel',                 provincie: 'gelderland',     bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Doetinchem-Noord',    stad: 'Doetinchem',           provincie: 'gelderland',     bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Doetinchem-Oost',     stad: 'Doetinchem',           provincie: 'gelderland',     bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Zevenaar-Noord',      stad: 'Zevenaar',             provincie: 'gelderland',     bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Winterswijk',         stad: 'Winterswijk',          provincie: 'gelderland',     bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Zutphen-Noord',       stad: 'Zutphen',              provincie: 'gelderland',     bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'Harderwijk-Noord',    stad: 'Harderwijk',           provincie: 'gelderland',     bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Harderwijk-West',     stad: 'Harderwijk',           provincie: 'gelderland',     bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Wijchen-Centrum',     stad: 'Wijchen',              provincie: 'gelderland',     bouwjaar: 1972, netcongestie: 'GROEN'  },

  // ── Overijssel (uitbreiding) ─────────────────────────────────────────────
  { wijk: 'Enschede-Oost',       stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Enschede-West',       stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Enschede-Zuid',       stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Roombeek',            stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 2008, netcongestie: 'ORANJE' },
  { wijk: 'Deppenbroek',         stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Twekkelerveld',       stad: 'Enschede',             provincie: 'overijssel',     bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Zwolle-Oost',         stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Zwolle-West',         stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Holtenbroek',         stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Aa-landen',           stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Berkum',              stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Hanzeland',           stad: 'Zwolle',               provincie: 'overijssel',     bouwjaar: 2003, netcongestie: 'ORANJE' },
  { wijk: 'Deventer-Noord',      stad: 'Deventer',             provincie: 'overijssel',     bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Deventer-Oost',       stad: 'Deventer',             provincie: 'overijssel',     bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Borgele',             stad: 'Deventer',             provincie: 'overijssel',     bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Colmschate',          stad: 'Deventer',             provincie: 'overijssel',     bouwjaar: 1982, netcongestie: 'ORANJE' },
  { wijk: 'Almelo-Noord',        stad: 'Almelo',               provincie: 'overijssel',     bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Almelo-Oost',         stad: 'Almelo',               provincie: 'overijssel',     bouwjaar: 1972, netcongestie: 'ORANJE' },
  { wijk: 'Hengelo-Noord',       stad: 'Hengelo',              provincie: 'overijssel',     bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Hengelo-Oost',        stad: 'Hengelo',              provincie: 'overijssel',     bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Hengelo-West',        stad: 'Hengelo',              provincie: 'overijssel',     bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Kampen-Noord',        stad: 'Kampen',               provincie: 'overijssel',     bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Kampen-IJsselmuiden', stad: 'Kampen',               provincie: 'overijssel',     bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Oldenzaal-Noord',     stad: 'Oldenzaal',            provincie: 'overijssel',     bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Borne-Centrum',       stad: 'Borne',                provincie: 'overijssel',     bouwjaar: 1972, netcongestie: 'GROEN'  },

  // ── Groningen (uitbreiding) ──────────────────────────────────────────────
  { wijk: 'Groningen-Oost',      stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1963, netcongestie: 'ORANJE' },
  { wijk: 'Groningen-West',      stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Lewenborg',           stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'De Wijert',           stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Vinkhuizen',          stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Paddepoel',           stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Beijum',              stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Groningen-Centrum',   stad: 'Groningen',            provincie: 'groningen',      bouwjaar: 1895, netcongestie: 'ORANJE' },
  { wijk: 'Assen-Centrum',       stad: 'Assen',                provincie: 'drenthe',        bouwjaar: 1895, netcongestie: 'GROEN'  },
  { wijk: 'Assen-Noord',         stad: 'Assen',                provincie: 'drenthe',        bouwjaar: 1972, netcongestie: 'GROEN'  },
  { wijk: 'Assen-Oost',          stad: 'Assen',                provincie: 'drenthe',        bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Assen-West',          stad: 'Assen',                provincie: 'drenthe',        bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Emmen-Centrum',       stad: 'Emmen',                provincie: 'drenthe',        bouwjaar: 1950, netcongestie: 'GROEN'  },
  { wijk: 'Emmen-Noord',         stad: 'Emmen',                provincie: 'drenthe',        bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Emmen-Oost',          stad: 'Emmen',                provincie: 'drenthe',        bouwjaar: 1972, netcongestie: 'GROEN'  },
  { wijk: 'Hoogeveen-Noord',     stad: 'Hoogeveen',            provincie: 'drenthe',        bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Hoogeveen-Oost',      stad: 'Hoogeveen',            provincie: 'drenthe',        bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Coevorden',           stad: 'Coevorden',            provincie: 'drenthe',        bouwjaar: 1968, netcongestie: 'GROEN'  },

  // ── Friesland (uitbreiding) ──────────────────────────────────────────────
  { wijk: 'Leeuwarden-Centrum',  stad: 'Leeuwarden',           provincie: 'friesland',      bouwjaar: 1895, netcongestie: 'GROEN'  },
  { wijk: 'Leeuwarden-Oost',     stad: 'Leeuwarden',           provincie: 'friesland',      bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Leeuwarden-West',     stad: 'Leeuwarden',           provincie: 'friesland',      bouwjaar: 1972, netcongestie: 'GROEN'  },
  { wijk: 'Sneek-Noord',         stad: 'Sneek',                provincie: 'friesland',      bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Sneek-Oost',          stad: 'Sneek',                provincie: 'friesland',      bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Heerenveen-Centrum',  stad: 'Heerenveen',           provincie: 'friesland',      bouwjaar: 1950, netcongestie: 'GROEN'  },
  { wijk: 'Heerenveen-Noord',    stad: 'Heerenveen',           provincie: 'friesland',      bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Drachten-Noord',      stad: 'Smallingerland',       provincie: 'friesland',      bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Drachten-Oost',       stad: 'Smallingerland',       provincie: 'friesland',      bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Harlingen',           stad: 'Harlingen',            provincie: 'friesland',      bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Franeker-Noord',      stad: 'Waadhoeke',            provincie: 'friesland',      bouwjaar: 1972, netcongestie: 'GROEN'  },

  // ── Limburg (uitbreiding) ────────────────────────────────────────────────
  { wijk: 'Maastricht-Noord',    stad: 'Maastricht',           provincie: 'limburg',        bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Maastricht-West',     stad: 'Maastricht',           provincie: 'limburg',        bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Maastricht-Centrum',  stad: 'Maastricht',           provincie: 'limburg',        bouwjaar: 1900, netcongestie: 'ORANJE' },
  { wijk: 'Heerlen-Centrum',     stad: 'Heerlen',              provincie: 'limburg',        bouwjaar: 1920, netcongestie: 'ORANJE' },
  { wijk: 'Heerlen-Noord',       stad: 'Heerlen',              provincie: 'limburg',        bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Sittard-Centrum',     stad: 'Sittard-Geleen',       provincie: 'limburg',        bouwjaar: 1910, netcongestie: 'GROEN'  },
  { wijk: 'Geleen-Noord',        stad: 'Sittard-Geleen',       provincie: 'limburg',        bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'Venlo-Noord',         stad: 'Venlo',                provincie: 'limburg',        bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Venlo-Oost',          stad: 'Venlo',                provincie: 'limburg',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Venlo-West',          stad: 'Venlo',                provincie: 'limburg',        bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Venray-Noord',        stad: 'Venray',               provincie: 'limburg',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Roermond-Noord',      stad: 'Roermond',             provincie: 'limburg',        bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Roermond-West',       stad: 'Roermond',             provincie: 'limburg',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Weert-Noord',         stad: 'Weert',                provincie: 'limburg',        bouwjaar: 1972, netcongestie: 'GROEN'  },
  { wijk: 'Weert-Oost',          stad: 'Weert',                provincie: 'limburg',        bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Kerkrade-West',       stad: 'Kerkrade',             provincie: 'limburg',        bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Kerkrade-Oost',       stad: 'Kerkrade',             provincie: 'limburg',        bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Brunssum',            stad: 'Brunssum',             provincie: 'limburg',        bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Landgraaf-Noord',     stad: 'Landgraaf',            provincie: 'limburg',        bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Vaals',               stad: 'Vaals',                provincie: 'limburg',        bouwjaar: 1968, netcongestie: 'GROEN'  },

  // ── Zeeland (uitbreiding) ────────────────────────────────────────────────
  { wijk: 'Middelburg-Centrum',  stad: 'Middelburg',           provincie: 'zeeland',        bouwjaar: 1895, netcongestie: 'GROEN'  },
  { wijk: 'Middelburg-Noord',    stad: 'Middelburg',           provincie: 'zeeland',        bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Vlissingen-West',     stad: 'Vlissingen',           provincie: 'zeeland',        bouwjaar: 1958, netcongestie: 'GROEN'  },
  { wijk: 'Vlissingen-Oost',     stad: 'Vlissingen',           provincie: 'zeeland',        bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Goes-Noord',          stad: 'Goes',                 provincie: 'zeeland',        bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Goes-Oost',           stad: 'Goes',                 provincie: 'zeeland',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Terneuzen-Noord',     stad: 'Terneuzen',            provincie: 'zeeland',        bouwjaar: 1962, netcongestie: 'GROEN'  },
  { wijk: 'Terneuzen-Oost',      stad: 'Terneuzen',            provincie: 'zeeland',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Hulst',               stad: 'Hulst',                provincie: 'zeeland',        bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Zierikzee',           stad: 'Schouwen-Duiveland',   provincie: 'zeeland',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Roosendaal-Oost',     stad: 'Roosendaal',           provincie: 'noord-brabant',  bouwjaar: 1978, netcongestie: 'GROEN'  },

  // ── CBS-data wijken (auto-gegenereerd via CBS kerncijfers 84799NED) ──────────
  { wijk: "Hoofddorp", stad: "Haarlemmermeer", provincie: "noord-holland", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 31987 },
  { wijk: "Veghel", stad: "Meierijstad", provincie: "noord-brabant", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 13764 },
  { wijk: "Jordaan", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1985, netcongestie: "ROOD", aantalWoningen: 13201 },
  { wijk: "Nieuw-Vennep", stad: "Haarlemmermeer", provincie: "noord-holland", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 12362 },
  { wijk: "Centrum", stad: "Groningen", provincie: "groningen", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 12288 },
  { wijk: "Breda noord", stad: "Breda", provincie: "noord-brabant", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 11457 },
  { wijk: "Zuidoost", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 11363 },
  { wijk: "Breda noord-west", stad: "Breda", provincie: "noord-brabant", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 11044 },
  { wijk: "Oud-Zuid", stad: "Groningen", provincie: "groningen", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 10747 },
  { wijk: "Roodenburgerdistrict", stad: "Leiden", provincie: "zuid-holland", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 10627 },
  { wijk: "Oud-Beijerland", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 10453 },
  { wijk: "West", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 10413 },
  { wijk: "Dongen", stad: "Dongen", provincie: "noord-brabant", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 10300 },
  { wijk: "Schijndel", stad: "Meierijstad", provincie: "noord-brabant", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 10273 },
  { wijk: "Oud-Noord", stad: "Groningen", provincie: "groningen", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 10256 },
  { wijk: "Helpman e.o.", stad: "Groningen", provincie: "groningen", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 10114 },
  { wijk: "Noordoost", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1985, netcongestie: "ORANJE", aantalWoningen: 10068 },
  { wijk: "Bos- en Gasthuisdistrict", stad: "Leiden", provincie: "zuid-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 9917 },
  { wijk: "Noordwest", stad: "Groningen", provincie: "groningen", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 9902 },
  { wijk: "Oude Pijp", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 9394 },
  { wijk: "Oost", stad: "Hilversum", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 9210 },
  { wijk: "Zuid", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 9201 },
  { wijk: "Oostelijk Havengebied", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 9176 },
  { wijk: "Breda zuid-oost", stad: "Breda", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 8960 },
  { wijk: "Hardenberg", stad: "Hardenberg", provincie: "overijssel", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 8462 },
  { wijk: "Holendrecht/Reigersbos", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 8336 },
  { wijk: "Cuijk", stad: "Cuijk", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 8322 },
  { wijk: "Oude Stad", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 8285 },
  { wijk: "Zuid", stad: "Hilversum", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 8252 },
  { wijk: "Erp", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 8169 },
  { wijk: "Slotermeer-Zuidwest", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 8039 },
  { wijk: "Middenmeer", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 8019 },
  { wijk: "Noord woongebied", stad: "Etten-Leur", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7983 },
  { wijk: "Aanschot", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 7975 },
  { wijk: "Osdorp-Oost", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 7928 },
  { wijk: "Staatsliedenbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 7822 },
  { wijk: "Nieuw-West", stad: "Groningen", provincie: "groningen", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7776 },
  { wijk: "Naarden", stad: "Gooise Meren", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7753 },
  { wijk: "Ontginning", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 7733 },
  { wijk: "Scheldebuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 7731 },
  { wijk: "Nieuwe Pijp", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 7730 },
  { wijk: "Sint-Oedenrode", stad: "Meierijstad", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7698 },
  { wijk: "Oost", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7582 },
  { wijk: "Beuningen", stad: "Beuningen", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7549 },
  { wijk: "Binnenstad-Noord", stad: "Leiden", provincie: "zuid-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7545 },
  { wijk: "Katwijk aan Zee", stad: "Katwijk", provincie: "zuid-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7543 },
  { wijk: "Noordoost", stad: "Groningen", provincie: "groningen", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7541 },
  { wijk: "Oud-Strijp", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 7538 },
  { wijk: "Buitenveldert-West", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 7535 },
  { wijk: "Noorddijk e.o.", stad: "Groningen", provincie: "groningen", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7426 },
  { wijk: "Oud-West", stad: "Groningen", provincie: "groningen", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7368 },
  { wijk: "Oosterparkwijk", stad: "Groningen", provincie: "groningen", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7363 },
  { wijk: "Zuid", stad: "Alkmaar", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7259 },
  { wijk: "Oostelijke Eilanden/Kadijken", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 7241 },
  { wijk: "Oud-Oost", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 7018 },
  { wijk: "Museumkwartier", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6848 },
  { wijk: "Rijnsburg", stad: "Katwijk", provincie: "zuid-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6788 },
  { wijk: "Oud-Gestel", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6779 },
  { wijk: "Schollevaar Zuid", stad: "Capelle aan den IJssel", provincie: "zuid-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6762 },
  { wijk: "Achtse Molen", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6720 },
  { wijk: "Indische Buurt West", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6706 },
  { wijk: "Kerk en Zanen", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6677 },
  { wijk: "Osdorp-Midden", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6616 },
  { wijk: "Westlandgracht", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6611 },
  { wijk: "Putten", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6601 },
  { wijk: "Stadionbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6559 },
  { wijk: "Bennekom", stad: "Ede", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6551 },
  { wijk: "Hoofddorppleinbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6525 },
  { wijk: "Zuidwest", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6455 },
  { wijk: "Keizer Karelpark", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6443 },
  { wijk: "Eng", stad: "Gooise Meren", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6424 },
  { wijk: "Centrum", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6294 },
  { wijk: "IJburg West", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6265 },
  { wijk: "Nieuwmarkt/Lastage", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6221 },
  { wijk: "Oosterparkbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6196 },
  { wijk: "Noord", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6157 },
  { wijk: "Dalfsen", stad: "Dalfsen", provincie: "overijssel", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6148 },
  { wijk: "Frankendael", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6146 },
  { wijk: "Haarlemmerhoutkwartier", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6142 },
  { wijk: "West", stad: "Alkmaar", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6134 },
  { wijk: "Dommelbeemd", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6100 },
  { wijk: "Merenwijkdistrict", stad: "Leiden", provincie: "zuid-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6097 },
  { wijk: "Ede-Veldhuizen", stad: "Ede", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6079 },
  { wijk: "Zuidwest", stad: "Groningen", provincie: "groningen", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6074 },
  { wijk: "Oudorp", stad: "Alkmaar", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6070 },
  { wijk: "Banne Buiksloot", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6051 },
  { wijk: "Spaarndammer- en Zeeheldenbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 6031 },
  { wijk: "Waardhuizen, Middenhoven", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 6023 },
  { wijk: "Oud-Stratum", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5991 },
  { wijk: "Begijnenbroek", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5891 },
  { wijk: "Houten Noord-West", stad: "Houten", provincie: "utrecht", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5882 },
  { wijk: "Groesbeek", stad: "Berg en Dal", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5866 },
  { wijk: "Haren-West e.o.", stad: "Groningen", provincie: "groningen", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5789 },
  { wijk: "Hoofdweg e.o.", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5787 },
  { wijk: "Daalmeer/Koedijk", stad: "Alkmaar", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5767 },
  { wijk: "Morsdistrict", stad: "Leiden", provincie: "zuid-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5757 },
  { wijk: "Sloter-/Riekerpolder", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5735 },
  { wijk: "Katwijk Noord", stad: "Katwijk", provincie: "zuid-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5659 },
  { wijk: "Haarlemmerbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5653 },
  { wijk: "Waterlandpleinbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5621 },
  { wijk: "Plaswijck", stad: "Gouda", provincie: "zuid-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5612 },
  { wijk: "Oud-Woensel", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5592 },
  { wijk: "Bussum Centrum", stad: "Gooise Meren", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5544 },
  { wijk: "De Laar", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5543 },
  { wijk: "De Kolenkit", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5537 },
  { wijk: "Dapperbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5522 },
  { wijk: "Druten", stad: "Druten", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5464 },
  { wijk: "Ede-Oost", stad: "Ede", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5430 },
  { wijk: "Laren", stad: "Laren", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5400 },
  { wijk: "Tuindorp Oostzaan", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5398 },
  { wijk: "Middelveldsche Akerpolder", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5383 },
  { wijk: "Dedemsvaart", stad: "Hardenberg", provincie: "overijssel", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5378 },
  { wijk: "Ter Kleefkwartier", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5370 },
  { wijk: "Zuid woongebied", stad: "Etten-Leur", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5352 },
  { wijk: "Noordoost", stad: "Hilversum", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5323 },
  { wijk: "Centrum", stad: "Hilversum", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5290 },
  { wijk: "Kustwijk", stad: "Lelystad", provincie: "flevoland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5286 },
  { wijk: "Rijnbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5284 },
  { wijk: "Rijkerswoerd", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5282 },
  { wijk: "Kern Heesch", stad: "Bernheze", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5273 },
  { wijk: "Gein", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5142 },
  { wijk: "Frederik Hendrikbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5122 },
  { wijk: "Halve Maan", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5083 },
  { wijk: "Blaricum", stad: "Blaricum", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5075 },
  { wijk: "Slotervaart Zuid", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ROOD", aantalWoningen: 5060 },
  { wijk: "Europawijk", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1975, netcongestie: "ORANJE", aantalWoningen: 5006 },
  { wijk: "Indische Buurt Oost", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4964 },
  { wijk: "Bankras, Kostverloren", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4956 },
  { wijk: "Centrum", stad: "Alkmaar", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4945 },
  { wijk: "Elsrijk", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4910 },
  { wijk: "Midden woongebied", stad: "Etten-Leur", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4884 },
  { wijk: "Volewijck", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4879 },
  { wijk: "Ede-Zuid", stad: "Ede", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4873 },
  { wijk: "Houten Noord-Oost", stad: "Houten", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4860 },
  { wijk: "Camminghaburen e.o.", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4854 },
  { wijk: "Diemen Centrum", stad: "Diemen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4834 },
  { wijk: "Hoogkerk e.o.", stad: "Groningen", provincie: "groningen", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4822 },
  { wijk: "Bovenkerk - Westwijk Noord", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4819 },
  { wijk: "Noord", stad: "Gouda", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4792 },
  { wijk: "Transvaalbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4723 },
  { wijk: "Centrum", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4666 },
  { wijk: "De Weteringschans", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4656 },
  { wijk: "Stevenshofdistrict", stad: "Leiden", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4652 },
  { wijk: "Zuid Pijp", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4621 },
  { wijk: "Havendiep", stad: "Lelystad", provincie: "flevoland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4620 },
  { wijk: "Binnenstad", stad: "Gouda", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4616 },
  { wijk: "Overtoomse Sluis", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4611 },
  { wijk: "Katwijk aan den Rijn", stad: "Katwijk", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4597 },
  { wijk: "Waterwijk-Landerijen", stad: "Lelystad", provincie: "flevoland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4578 },
  { wijk: "Groenelaan", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4563 },
  { wijk: "Buitenveldert-Oost", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4555 },
  { wijk: "Zuidwest", stad: "Hilversum", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4515 },
  { wijk: "Potmargezone", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4508 },
  { wijk: "Vredenburg/Kronenburg", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4446 },
  { wijk: "Sonnenborgh e.o.", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4440 },
  { wijk: "Zuidoost", stad: "Hilversum", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4421 },
  { wijk: "Houten Zuid-West", stad: "Houten", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4421 },
  { wijk: "Binnenstad", stad: "Middelburg", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4414 },
  { wijk: "Middelwatering Oost", stad: "Capelle aan den IJssel", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4413 },
  { wijk: "De Korte Akkeren", stad: "Gouda", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4403 },
  { wijk: "Van Lennepbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4396 },
  { wijk: "Zegersloot", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4389 },
  { wijk: "Kort Haarlem", stad: "Gouda", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4364 },
  { wijk: "Transvaalwijk", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4342 },
  { wijk: "Werkendam", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4338 },
  { wijk: "Grachtengordel-West", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4309 },
  { wijk: "Weesperbuurt/Plantage", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4291 },
  { wijk: "Velperweg e.o.", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4285 },
  { wijk: "Helmersbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4270 },
  { wijk: "Binnenstad", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4260 },
  { wijk: "Oud-Tongelre", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4247 },
  { wijk: "Elderveld", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4236 },
  { wijk: "Voorburg Midden", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4196 },
  { wijk: "Binnenstad-Zuid", stad: "Leiden", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4185 },
  { wijk: "Malburgen-Oost", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4164 },
  { wijk: "Oudshoorn", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4160 },
  { wijk: "IJplein/Vogelbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4151 },
  { wijk: "Slotermeer-Noordoost", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4144 },
  { wijk: "Amsterdamsewijk", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4114 },
  { wijk: "Presikhaaf-West", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4101 },
  { wijk: "Klarendal", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4083 },
  { wijk: "Lage Zijde", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4079 },
  { wijk: "Kortonjo", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 4045 },
  { wijk: "Eemnes", stad: "Eemnes", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4008 },
  { wijk: "Numansdorp", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4004 },
  { wijk: "Te Zaanenkwartier", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 4000 },
  { wijk: "Indischewijk", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3984 },
  { wijk: "Strijen", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3956 },
  { wijk: "Zijlwegkwartier", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3935 },
  { wijk: "'s-Gravendeel", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3935 },
  { wijk: "Molenwijk", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3929 },
  { wijk: "Omval/Overamstel", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3908 },
  { wijk: "Apollobuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3896 },
  { wijk: "Medemblik", stad: "Medemblik", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3887 },
  { wijk: "Grou e.o.", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3867 },
  { wijk: "Hoge Zijde", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3861 },
  { wijk: "Bovenveen", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3860 },
  { wijk: "Oostgaarde Zuid", stad: "Capelle aan den IJssel", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3832 },
  { wijk: "Breda zuid", stad: "Breda", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3831 },
  { wijk: "Nieuwleusen", stad: "Dalfsen", provincie: "overijssel", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3825 },
  { wijk: "Middelwatering West", stad: "Capelle aan den IJssel", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3816 },
  { wijk: "Kinkerbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3807 },
  { wijk: "Centrum", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3800 },
  { wijk: "Presikhaaf-Oost", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3797 },
  { wijk: "Bolder", stad: "Lelystad", provincie: "flevoland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3769 },
  { wijk: "Bilthoven Zuid West", stad: "De Bilt", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3767 },
  { wijk: "Capelle West en 's Gravenland", stad: "Capelle aan den IJssel", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3761 },
  { wijk: "Houten Zuid-Oost", stad: "Houten", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3730 },
  { wijk: "Gestelse Ontginning", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3691 },
  { wijk: "Geuzenbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3689 },
  { wijk: "Oostzanerwerf", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3689 },
  { wijk: "Stiens e.o.", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3657 },
  { wijk: "Bilgaard & Havankpark e.o.", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3632 },
  { wijk: "Westindische Buurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3631 },
  { wijk: "Doornakkers", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3624 },
  { wijk: "Houtvaartkwartier", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3621 },
  { wijk: "Aldlân & De Hemrik", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3619 },
  { wijk: "Wervershoof", stad: "Medemblik", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3603 },
  { wijk: "Huiswaard", stad: "Alkmaar", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3573 },
  { wijk: "Huizum-West", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3564 },
  { wijk: "Noordwest", stad: "Hilversum", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3533 },
  { wijk: "Spijkerkwartier", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3504 },
  { wijk: "Voorburg Noord", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3495 },
  { wijk: "Grachtengordel-Zuid", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3489 },
  { wijk: "Noordelijke IJ-oevers West", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3473 },
  { wijk: "Rozenknopje", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3447 },
  { wijk: "Slotervaart Noord", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3430 },
  { wijk: "Stromenwijk/'t Zand", stad: "Middelburg", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3428 },
  { wijk: "Burgemeesterswijk/Hoogkamp", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3379 },
  { wijk: "Centrum", stad: "Beverwijk", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3378 },
  { wijk: "Middelharnis", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3368 },
  { wijk: "Centrum", stad: "Meppel", provincie: "drenthe", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3366 },
  { wijk: "Centrum", stad: "Lisse", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3344 },
  { wijk: "Teteringen", stad: "Breda", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3317 },
  { wijk: "Holland Park", stad: "Diemen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3287 },
  { wijk: "'t Lien / De Rietvink", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3276 },
  { wijk: "Lisse Zuid", stad: "Lisse", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3256 },
  { wijk: "Sommelsdijk", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3251 },
  { wijk: "Meerestein", stad: "Beverwijk", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3247 },
  { wijk: "Diemen Zuid", stad: "Diemen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3237 },
  { wijk: "Oosterboer", stad: "Meppel", provincie: "drenthe", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3218 },
  { wijk: "Van Galenbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3216 },
  { wijk: "Hillegom Zuid", stad: "Hillegom", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3213 },
  { wijk: "Heythuysen", stad: "Leudal", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3179 },
  { wijk: "Middelburg Zuid", stad: "Middelburg", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3172 },
  { wijk: "Rietkampen", stad: "Ede", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3168 },
  { wijk: "Voorburg Oud", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3159 },
  { wijk: "Puttershoek", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3158 },
  { wijk: "Damsigt en omgeving", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3146 },
  { wijk: "Sluispolder", stad: "Maassluis", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3129 },
  { wijk: "Koedijkslanden", stad: "Meppel", provincie: "drenthe", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3127 },
  { wijk: "Oostgaarde Noord", stad: "Capelle aan den IJssel", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3111 },
  { wijk: "Erasmuspark", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3082 },
  { wijk: "IJburg Zuid", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3081 },
  { wijk: "Parkwijk", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 3069 },
  { wijk: "Weesperzijde", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3015 },
  { wijk: "IJselbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 3011 },
  { wijk: "Lisse Noord", stad: "Lisse", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2977 },
  { wijk: "Chassébuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 2975 },
  { wijk: "Muiden", stad: "Gooise Meren", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2973 },
  { wijk: "Burgwallen-Oude Zijde", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 2971 },
  { wijk: "Burgwallen-Nieuwe Zijde", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 2961 },
  { wijk: "Hillegom Midden", stad: "Hillegom", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2944 },
  { wijk: "Andijk", stad: "Medemblik", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2916 },
  { wijk: "Diemen Noord", stad: "Diemen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2913 },
  { wijk: "Leidschendam - Zuid en omgeving", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2878 },
  { wijk: "Essesteijn", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2869 },
  { wijk: "Schenkel", stad: "Capelle aan den IJssel", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2865 },
  { wijk: "Slachthuiswijk", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2862 },
  { wijk: "St. Marten/Sonsbeek", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2841 },
  { wijk: "Kern Heeswijk-Dinther", stad: "Bernheze", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2832 },
  { wijk: "Erp", stad: "Meierijstad", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2809 },
  { wijk: "Kuenenkwartier", stad: "Beverwijk", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2773 },
  { wijk: "Maandereng", stad: "Ede", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2773 },
  { wijk: "Arnhemse Broek", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2760 },
  { wijk: "De Bilt West", stad: "De Bilt", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2752 },
  { wijk: "Westwijk Zuid", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2740 },
  { wijk: "Zeeburgereiland/Nieuwe Diep", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 2735 },
  { wijk: "De Laak", stad: "Eindhoven", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 2725 },
  { wijk: "Da Costabuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 2681 },
  { wijk: "Prinsenhof", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2676 },
  { wijk: "Boarnsterhim", stad: "Heerenveen", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2664 },
  { wijk: "Willemspark", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 2656 },
  { wijk: "Graft-De Rijp", stad: "Alkmaar", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2649 },
  { wijk: "De Punt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 2639 },
  { wijk: "Millingen aan de Rijn", stad: "Berg en Dal", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2631 },
  { wijk: "Duinwijk", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2629 },
  { wijk: "Ouddorp", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2622 },
  { wijk: "Boerhaavedistrict", stad: "Leiden", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2561 },
  { wijk: "De Zijde / Duivenvoorde / Park Veursehou", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2526 },
  { wijk: "Randwijck", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2522 },
  { wijk: "Zuidas", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 2489 },
  { wijk: "Hazerswoude-Dorp", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2482 },
  { wijk: "Wijk en Aalburg", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2479 },
  { wijk: "Wognum", stad: "Medemblik", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2475 },
  { wijk: "Ten Boer e.o.", stad: "Groningen", provincie: "groningen", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2468 },
  { wijk: "Hoorn", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2461 },
  { wijk: "Obdam", stad: "Koggenland", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2460 },
  { wijk: "Dirksland", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2440 },
  { wijk: "Heinkenszand", stad: "Borsele", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2422 },
  { wijk: "Nijlân & De Zwette", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2391 },
  { wijk: "Schinkelbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 2389 },
  { wijk: "De Leijen", stad: "De Bilt", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2365 },
  { wijk: "Vondelkwartier", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2362 },
  { wijk: "Sleeuwijk", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2358 },
  { wijk: "Spiegel", stad: "Gooise Meren", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2358 },
  { wijk: "Hazerswoude-Rijndijk", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2348 },
  { wijk: "De Bilt Oost", stad: "De Bilt", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2312 },
  { wijk: "Monnikenhuizen", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2302 },
  { wijk: "Bilthoven Zuid Oost", stad: "De Bilt", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2273 },
  { wijk: "Valkenburg", stad: "Katwijk", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2243 },
  { wijk: "Schermer", stad: "Alkmaar", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2242 },
  { wijk: "Kern Nistelrode", stad: "Bernheze", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2240 },
  { wijk: "Haren-Oost e.o.", stad: "Groningen", provincie: "groningen", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2232 },
  { wijk: "Heechterp & Schieringen", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2194 },
  { wijk: "Geitenkamp", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2192 },
  { wijk: "Haveltermade", stad: "Meppel", provincie: "drenthe", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2182 },
  { wijk: "Nieuw-Bergen", stad: "Bergen (L.)", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2151 },
  { wijk: "Malburgen-West", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2136 },
  { wijk: "Voorburg West / Park Leeuwenbergh", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2131 },
  { wijk: "Vossepark & Helicon", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2125 },
  { wijk: "Maartensdijk", stad: "De Bilt", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2114 },
  { wijk: "Oude-Tonge", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2103 },
  { wijk: "Oosterwijk en Zwaansmeer", stad: "Beverwijk", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2100 },
  { wijk: "Vogelenwijk", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2096 },
  { wijk: "Hempens/Teerns & Zuiderburen", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2077 },
  { wijk: "Arnemuiden", stad: "Middelburg", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2025 },
  { wijk: "Woudrichem", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 2006 },
  { wijk: "Haelen", stad: "Leudal", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1997 },
  { wijk: "Heijenoord/Lombok", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1982 },
  { wijk: "Lelystad-Haven", stad: "Lelystad", provincie: "flevoland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1974 },
  { wijk: "Mijnsheerenland", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1958 },
  { wijk: "Betondorp", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 1957 },
  { wijk: "Kernhem", stad: "Ede", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1918 },
  { wijk: "Lemelerveld", stad: "Dalfsen", provincie: "overijssel", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1916 },
  { wijk: "Roggel", stad: "Leudal", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1880 },
  { wijk: "Broekpolder", stad: "Beverwijk", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1875 },
  { wijk: "Hilversumse Meent", stad: "Hilversum", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1829 },
  { wijk: "Vondelkwartier", stad: "Beverwijk", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1805 },
  { wijk: "'s-Gravenpolder", stad: "Borsele", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1804 },
  { wijk: "Koudekerk aan den Rijn", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1801 },
  { wijk: "Vijfhuizen", stad: "Haarlemmermeer", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1800 },
  { wijk: "Westeinde e.o.", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1797 },
  { wijk: "Vrijheidswijk", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1784 },
  { wijk: "Hillegom Noord", stad: "Hillegom", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1783 },
  { wijk: "De Heuvel / Amstelwijk", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1775 },
  { wijk: "Klaaswaal", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1755 },
  { wijk: "Beekbergen en omgeving", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1745 },
  { wijk: "Rijsenhout", stad: "Haarlemmermeer", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1741 },
  { wijk: "Stadshart", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1729 },
  { wijk: "Alteveer/Cranevelt", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1718 },
  { wijk: "Dorpen Zuid-Oost", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1695 },
  { wijk: "Dorpen Zuid-West", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1687 },
  { wijk: "Klarenbeek", stad: "Middelburg", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1677 },
  { wijk: "Nellestein", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 1675 },
  { wijk: "Beek", stad: "Berg en Dal", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1646 },
  { wijk: "Hank", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1644 },
  { wijk: "Horn", stad: "Leudal", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1642 },
  { wijk: "Ewijk", stad: "Beuningen", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1640 },
  { wijk: "Kloosterzande", stad: "Hulst", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1640 },
  { wijk: "Brediuskwartier", stad: "Gooise Meren", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1627 },
  { wijk: "Elzenhagen", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 1620 },
  { wijk: "Houthavens", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 1617 },
  { wijk: "Zuid-Beijerland", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1617 },
  { wijk: "Nieuwendijk", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1597 },
  { wijk: "Schollevaar Noord", stad: "Capelle aan den IJssel", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1591 },
  { wijk: "Asten zuid", stad: "Asten", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1568 },
  { wijk: "Nijeveen", stad: "Meppel", provincie: "drenthe", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1567 },
  { wijk: "Zuidoost", stad: "Groningen", provincie: "groningen", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1566 },
  { wijk: "Stellendam", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1562 },
  { wijk: "Almkerk", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1552 },
  { wijk: "Heinenoord", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1546 },
  { wijk: "Nieuw-Beijerland", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1536 },
  { wijk: "Griffioen", stad: "Middelburg", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1527 },
  { wijk: "Asten centrum / west", stad: "Asten", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1526 },
  { wijk: "Balkbrug", stad: "Hardenberg", provincie: "overijssel", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1509 },
  { wijk: "Sint Jansteen", stad: "Hulst", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1504 },
  { wijk: "Neer", stad: "Leudal", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1487 },
  { wijk: "Avenhorn", stad: "Koggenland", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1461 },
  { wijk: "De Goorn", stad: "Koggenland", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1425 },
  { wijk: "Hillegom West", stad: "Hillegom", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1421 },
  { wijk: "Loenen en omgeving", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1408 },
  { wijk: "Patrimonium", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1407 },
  { wijk: "Benthuizen", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1399 },
  { wijk: "Maasdam", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1393 },
  { wijk: "Gramsbergen", stad: "Hardenberg", provincie: "overijssel", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1379 },
  { wijk: "Lisserbroek", stad: "Haarlemmermeer", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1353 },
  { wijk: "Kadoelen", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 1345 },
  { wijk: "Slagharen", stad: "Hardenberg", provincie: "overijssel", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1333 },
  { wijk: "Dokkumer Ie e.o.", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1323 },
  { wijk: "Spaarndam", stad: "Haarlemmermeer", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1300 },
  { wijk: "Noordwestelijk tuinbouwgebied", stad: "Beverwijk", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1290 },
  { wijk: "Goutum", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1282 },
  { wijk: "Bergentheim", stad: "Hardenberg", provincie: "overijssel", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1256 },
  { wijk: "Berg en Dal", stad: "Berg en Dal", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1255 },
  { wijk: "Centrale Markt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 1245 },
  { wijk: "Ursem", stad: "Koggenland", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1209 },
  { wijk: "Ederveen", stad: "Ede", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1202 },
  { wijk: "Asten noord", stad: "Asten", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1196 },
  { wijk: "Haps", stad: "Cuijk", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1192 },
  { wijk: "Berggierslanden", stad: "Meppel", provincie: "drenthe", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1181 },
  { wijk: "Harskamp", stad: "Ede", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1178 },
  { wijk: "Uilenstede, Kronenburg", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1153 },
  { wijk: "Ooij", stad: "Berg en Dal", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1148 },
  { wijk: "Veen", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1142 },
  { wijk: "Rivium", stad: "Capelle aan den IJssel", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1119 },
  { wijk: "Glimmen-Onnen-Noordlaren", stad: "Groningen", provincie: "groningen", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1114 },
  { wijk: "Breedeweg", stad: "Berg en Dal", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1109 },
  { wijk: "Wenum Wiesel Beemte", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1104 },
  { wijk: "Ooltgensplaat", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1090 },
  { wijk: "Berkhout", stad: "Koggenland", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1087 },
  { wijk: "Clinge", stad: "Hulst", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1072 },
  { wijk: "Otterlo", stad: "Ede", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1069 },
  { wijk: "Baexem", stad: "Leudal", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1061 },
  { wijk: "Buitengebied Heeswijk-Dinther", stad: "Bernheze", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1060 },
  { wijk: "Well", stad: "Bergen (L.)", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1056 },
  { wijk: "Weurt", stad: "Beuningen", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1056 },
  { wijk: "Dussen", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1047 },
  { wijk: "Stationsdistrict", stad: "Leiden", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1039 },
  { wijk: "Midwoud", stad: "Medemblik", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1039 },
  { wijk: "Nieuwe-Tonge", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1030 },
  { wijk: "Uddel en omgeving", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1026 },
  { wijk: "Nieuw Middelburg", stad: "Middelburg", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1025 },
  { wijk: "Goedereede", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1019 },
  { wijk: "Halfweg", stad: "Haarlemmermeer", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1012 },
  { wijk: "Asten oost", stad: "Asten", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 1004 },
  { wijk: "'s Gravenmoer", stad: "Dongen", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 989 },
  { wijk: "Andel", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 986 },
  { wijk: "Buitengebied Ede-Stad", stad: "Ede", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 981 },
  { wijk: "Nibbixwoud", stad: "Medemblik", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 981 },
  { wijk: "Stompwijk", stad: "Leidschendam-Voorburg", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 957 },
  { wijk: "Vondelbuurt", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 943 },
  { wijk: "Oranjebuurt", stad: "Beverwijk", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 940 },
  { wijk: "Wekerom", stad: "Ede", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 938 },
  { wijk: "Westmaas", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 938 },
  { wijk: "Eendracht", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 933 },
  { wijk: "Vessem", stad: "Eersel", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 930 },
  { wijk: "Melissant", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 922 },
  { wijk: "'s-Heerenhoek", stad: "Borsele", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 919 },
  { wijk: "Abbekerk", stad: "Medemblik", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 917 },
  { wijk: "Afferden", stad: "Bergen (L.)", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 916 },
  { wijk: "Tuindorp Buiksloot", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 912 },
  { wijk: "Veersepoort", stad: "Middelburg", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 909 },
  { wijk: "Heusden wonen", stad: "Asten", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 899 },
  { wijk: "De Krim", stad: "Hardenberg", provincie: "overijssel", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 899 },
  { wijk: "Buitengebied Nistelrode", stad: "Bernheze", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 898 },
  { wijk: "Waterland", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 895 },
  { wijk: "Winssen", stad: "Beuningen", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 892 },
  { wijk: "Klingelbeek e.o.", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 879 },
  { wijk: "Siebengewald", stad: "Bergen (L.)", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 870 },
  { wijk: "Vogelwaarde", stad: "Hulst", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 847 },
  { wijk: "Stadshart", stad: "Lelystad", provincie: "flevoland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 844 },
  { wijk: "Wintelre", stad: "Eersel", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 841 },
  { wijk: "Goudswaard", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 840 },
  { wijk: "Mortiere", stad: "Middelburg", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 832 },
  { wijk: "Deest", stad: "Druten", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 815 },
  { wijk: "De Zuidlanden", stad: "Leeuwarden", provincie: "fryslan", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 809 },
  { wijk: "Duizel", stad: "Eersel", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 808 },
  { wijk: "Lutten", stad: "Hardenberg", provincie: "overijssel", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 797 },
  { wijk: "Zwaanshoek", stad: "Haarlemmermeer", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 786 },
  { wijk: "Opperdoes", stad: "Medemblik", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 786 },
  { wijk: "Lewedorp", stad: "Borsele", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 764 },
  { wijk: "Leuth", stad: "Berg en Dal", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 762 },
  { wijk: "Buitengebied", stad: "Lisse", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 753 },
  { wijk: "Klarenbeek en omgeving", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 752 },
  { wijk: "Schaarsbergen", stad: "Arnhem", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 752 },
  { wijk: "Rijswijk", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 749 },
  { wijk: "Waarder- en Veerpolder", stad: "Haarlem", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 747 },
  { wijk: "Ittervoort", stad: "Leudal", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 744 },
  { wijk: "Den Bommel", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 738 },
  { wijk: "Groenekan", stad: "De Bilt", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 733 },
  { wijk: "Piershil", stad: "Hoeksche Waard", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 732 },
  { wijk: "Grathem", stad: "Leudal", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 716 },
  { wijk: "Abbenes / Buitenkaag", stad: "Haarlemmermeer", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 702 },
  { wijk: "Beers", stad: "Cuijk", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 699 },
  { wijk: "Prinses Irenebuurt e.o.", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 695 },
  { wijk: "Buitengebied Zuid", stad: "Amstelveen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 677 },
  { wijk: "Veluwse Poort", stad: "Ede", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 675 },
  { wijk: "Genderen", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 670 },
  { wijk: "Hoenderloo en omgeving", stad: "Apeldoorn", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 659 },
  { wijk: "Afferden", stad: "Druten", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 659 },
  { wijk: "Stad aan 't Haringvliet", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 653 },
  { wijk: "Schalkwijk", stad: "Houten", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 653 },
  { wijk: "Horssen", stad: "Druten", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 652 },
  { wijk: "Warande", stad: "Beverwijk", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 650 },
  { wijk: "Bedrijventerrein Sloterdijk", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 646 },
  { wijk: "Plantage de Sniep", stad: "Diemen", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 641 },
  { wijk: "Giessen", stad: "Altena", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 629 },
  { wijk: "Nieuwendammerdijk/Buiksloterdijk", stad: "Amsterdam", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "ROOD", aantalWoningen: 629 },
  { wijk: "Spierdijk", stad: "Koggenland", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 620 },
  { wijk: "Steensel", stad: "Eersel", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 619 },
  { wijk: "Ten Post e.o.", stad: "Groningen", provincie: "groningen", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 611 },
  { wijk: "Hensbroek", stad: "Koggenland", provincie: "noord-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 610 },
  { wijk: "Knegsel", stad: "Eersel", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 603 },
  { wijk: "Kloosterhaar", stad: "Hardenberg", provincie: "overijssel", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 591 },
  { wijk: "Neeritter", stad: "Leudal", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 586 },
  { wijk: "Hollandsche Rading", stad: "De Bilt", provincie: "utrecht", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 578 },
  { wijk: "Ell", stad: "Leudal", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 567 },
  { wijk: "Ovezande", stad: "Borsele", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 562 },
  { wijk: "Borssele", stad: "Borsele", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 546 },
  { wijk: "Meerstad e.o.", stad: "Groningen", provincie: "groningen", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 544 },
  { wijk: "Herkingen", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 543 },
  { wijk: "Puiflijk", stad: "Druten", provincie: "gelderland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 536 },
  { wijk: "Nieuwdorp", stad: "Borsele", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 526 },
  { wijk: "Graauw", stad: "Hulst", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 524 },
  { wijk: "Nieuw- en Sint Joosland", stad: "Middelburg", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 523 },
  { wijk: "Heikant", stad: "Hulst", provincie: "zeeland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 517 },
  { wijk: "Achthuizen", stad: "Goeree-Overflakkee", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 514 },
  { wijk: "Wellerlooi", stad: "Bergen (L.)", provincie: "limburg", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 507 },
  { wijk: "Aarlanderveen", stad: "Alphen aan den Rijn", provincie: "zuid-holland", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 505 },
  { wijk: "Vianen", stad: "Cuijk", provincie: "noord-brabant", bouwjaar: 1978, netcongestie: "GROEN", aantalWoningen: 500 },
]

// ─── Main ────────────────────────────────────────────────────────────────────

async function run() {
  const dryRun       = process.argv.includes('--dry-run')
  const skipExisting = process.argv.includes('--skip-existing')
  const batchArg     = process.argv.find(a => a.startsWith('--batch='))
  const [batchFrom, batchTo] = batchArg
    ? batchArg.replace('--batch=', '').split(',').map(Number)
    : [0, WIJKEN.length]

  const subset = WIJKEN.slice(batchFrom, batchTo)

  console.log('\n══════════════════════════════════════════════════════')
  console.log('SaldeerScan.nl — pSEO Wijk Seeder v2 (Gemini voor elk)')
  console.log('══════════════════════════════════════════════════════')
  console.log(`Wijken:        ${subset.length} (index ${batchFrom}–${Math.min(batchTo, WIJKEN.length) - 1})`)
  console.log(`Modus:         ${dryRun ? 'DRY RUN (geen DB/AI writes)' : 'LIVE'}`)
  console.log(`Skip existing: ${skipExisting ? 'ja' : 'nee'}`)
  console.log(`AI:            Gemini 2.5 Flash — 800w + 5 FAQs + JSON-LD per wijk`)
  console.log(`CBS PDOK:      aantalWoningen live ophalen per wijk`)
  console.log(`Geschatte tijd: ~${Math.ceil(subset.length * 4 / 60)} minuten`)
  console.log('──────────────────────────────────────────────────────\n')

  let stats = { ok: 0, skip: 0, fail: 0 }

  for (let i = 0; i < subset.length; i++) {
    const entry = subset[i]
    const nr    = `[${String(i + 1).padStart(3, '0')}/${subset.length}]`
    process.stdout.write(`${nr} ${entry.wijk}, ${entry.stad} ... `)

    try {
      const result = await seedWijk(entry, { dryRun, skipExisting })
      if      (result === 'ok')      stats.ok++
      else if (result === 'skipped') stats.skip++
      else                           stats.fail++
    } catch (err) {
      process.stdout.write(`FOUT: ${err instanceof Error ? err.message : String(err)}\n`)
      stats.fail++
    }

    // Gemini rate limiting: 2s tussen calls, elke 10 wijken extra rust
    if (!dryRun) {
      await sleep(i > 0 && i % 10 === 0 ? 5000 : 2000)
    }
  }

  console.log('\n══════════════════════════════════════════════════════')
  console.log(`Gereed: ${stats.ok} gegenereerd, ${stats.skip} overgeslagen, ${stats.fail} fouten`)
  if (stats.fail > 0) {
    console.log('\n⚠ Herstart met --skip-existing om alleen mislukte wijken opnieuw te proberen.')
  }
  console.log('══════════════════════════════════════════════════════\n')
}

run().catch(err => {
  console.error('\nFatale fout:', err)
  process.exit(1)
})