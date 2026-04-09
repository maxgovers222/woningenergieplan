/**
 * Golden Batch Seed — SaldeerScan.nl
 *
 * Fase 1 — Golden Batch (27 focus-wijken):
 *   Gemini 2.5 Flash genereert rijke content (titel + meta + 600w + 3 FAQs + JSON-LD)
 *   status: 'published' — direct live na seeden
 *
 * Fase 2 — Extended Batch (~150 representatieve wijken):
 *   Template-content — géén AI-calls, gratis
 *   status: 'draft' — wacht op handmatige review/publicatie
 *
 * Gebruik:
 *   npx tsx scripts/seed-wijken.ts --only-golden   # Alleen Top 27 (aanbevolen voor start)
 *   npx tsx scripts/seed-wijken.ts                  # Alles (Golden + Extended)
 *   npx tsx scripts/seed-wijken.ts --dry-run        # Simuleer zonder DB-writes
 *   npx tsx scripts/seed-wijken.ts --preview        # Toon template-content preview (geen DB)
 *
 * Uitbreiden naar 2000:
 *   Vervang EXTENDED_BATCH door een CBS WFS fetch:
 *   https://service.pdok.nl/cbs/gebiedsindelingen/2023/wfs/v1_0
 *   ?request=GetFeature&service=WFS&version=2.0.0
 *   &typeName=cbs_wijk_2023&outputFormat=application/json&count=2000
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local — tsx laadt dit niet automatisch
const __dir = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dir, '..', '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const GOOGLE_KEY = process.env.GOOGLE_AI_API_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_KEY) {
  console.error('\nFout: ontbrekende env vars. Controleer .env.local:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_AI_API_KEY\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const genAI = new GoogleGenerativeAI(GOOGLE_KEY)

// ─── Types ─────────────────────────────────────────────────────────────────

type Netcongestie = 'ROOD' | 'ORANJE' | 'GROEN'

interface WijkEntry {
  wijk: string
  stad: string
  provincie: string
  bouwjaar: number
  netcongestie: Netcongestie
}

interface RichContent {
  titel: string
  metaDescription: string
  hoofdtekst: string
  faqItems: { vraag: string; antwoord: string }[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics (â → a, ë → e etc.)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function deriveHealthScore(bouwjaar: number, netcongestie: Netcongestie): number {
  let score = 70
  if (bouwjaar >= 2005)      score += 12
  else if (bouwjaar >= 2000) score += 8
  else if (bouwjaar >= 1990) score += 3
  else if (bouwjaar < 1970)  score -= 8
  if (netcongestie === 'ROOD')   score -= 5
  if (netcongestie === 'GROEN')  score += 5
  return Math.min(95, Math.max(45, score))
}

function buildJsonLd(e: WijkEntry, titel: string, meta: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: titel,
    description: meta,
    url: `https://saldeerscan.nl/${e.provincie}/${toSlug(e.stad)}/${toSlug(e.wijk)}`,
    about: {
      '@type': 'Place',
      name: `${e.wijk}, ${e.stad}`,
      addressLocality: e.stad,
      addressRegion: e.provincie.replace(/-/g, ' '),
      addressCountry: 'NL',
    },
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ─── Content generators ────────────────────────────────────────────────────

async function generateRichContent(e: WijkEntry): Promise<RichContent> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const score = deriveHealthScore(e.bouwjaar, e.netcongestie)

  const congestieFocus =
    e.netcongestie === 'ROOD'
      ? 'de rode netcongestie — een thuisbatterij is hier essentieel om overschot lokaal op te slaan'
      : e.netcongestie === 'ORANJE'
      ? 'de groeiende netdruk — batterijopslag optimaliseert de teruglevering nu al'
      : 'de gunstige groene netstatus — ideale omstandigheden voor maximale teruglevering'

  const prompt = `Je bent een SEO-expert voor de Nederlandse energiemarkt. Schrijf een SEO-artikel van precies 600 woorden voor SaldeerScan.nl.

Onderwerp: Zonnepanelen en energiebesparing voor woningen in de wijk ${e.wijk} in ${e.stad} (${e.provincie.replace(/-/g, ' ')}).

Context:
- Gemiddeld bouwjaar woningen: ${e.bouwjaar}
- Netcongestie-status: ${e.netcongestie}
- Energie-gezondheidscore: ${score}/100

Schrijf over: de specifieke kansen voor woningen uit ${e.bouwjaar} bij het einde van salderen op 1 januari 2027. Bespreek dakpotentieel, zonnepaneel-rendement (€400–€900/jaar besparing afhankelijk van type), en ${congestieFocus}. Schrijf direct voor de huiseigenaar in ${e.wijk}. Gebruik concrete euro-bedragen. Vermijd jargon.

Geef ook:
- SEO-titel (max 60 tekens, bevat wijk + stad + 2027)
- Meta-description (max 155 tekens)
- 3 FAQ-vragen met antwoord (elk antwoord 2–3 zinnen)

Antwoord UITSLUITEND in dit JSON-formaat:
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
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Geen JSON in Gemini-respons voor ${e.wijk}`)

  const parsed = JSON.parse(jsonMatch[0]) as RichContent
  if (!parsed.titel || !parsed.hoofdtekst || !Array.isArray(parsed.faqItems)) {
    throw new Error(`Incomplete JSON voor ${e.wijk}`)
  }
  return parsed
}

function generateTemplateContent(e: WijkEntry): RichContent {
  const { wijk, stad, bouwjaar, netcongestie } = e

  const netwerkTekst =
    netcongestie === 'ROOD'
      ? 'Het net is zwaar belast (rood). Een thuisbatterij is sterk aanbevolen om zelf-opgewekte stroom lokaal op te slaan.'
      : netcongestie === 'ORANJE'
      ? 'Het net raakt steeds voller (oranje). Batterijopslag optimaliseert de teruglevering en beschermt de investering.'
      : 'De netcapaciteit is groen — ideale omstandigheden voor directe teruglevering zonder restricties.'

  const bouwjaarKarakter =
    bouwjaar >= 2005
      ? `Woningen uit ${bouwjaar} hebben doorgaans een uitstekende dakisolatie en een moderne groepenkast die zonnepanelen ondersteunt zonder extra aanpassingen.`
      : bouwjaar >= 1995
      ? `Woningen uit ${bouwjaar} voldoen in de meeste gevallen aan de minimale eisen voor zonnepanelen. Een snelle check via SaldeerScan.nl bevestigt de specifieke situatie.`
      : `Woningen uit ${bouwjaar} vereisen soms een dakcheck of groepenkast-upgrade. Dit verlaagt de netto-investering minimaal en de terugverdientijd blijft marktconform.`

  return {
    titel: `${wijk} ${stad} — 2027 Saldeercheck`,
    metaDescription: `Gratis 2027 saldeercheck voor woningen in ${wijk}, ${stad}. AI-scan, ROI en investeringsrapport in 5 minuten.`,
    hoofdtekst: `Woningen in ${wijk}, ${stad} (gemiddeld bouwjaar ${bouwjaar}) staan voor een ingrijpende energietransitie. Per 1 januari 2027 eindigt het salderingsstelsel definitief — teruggeleverde stroom wordt dan nog slechts vergoed tegen het lage teruglevertarief (±€0,04/kWh) in plaats van het volledige stroomtarief (±€0,23/kWh).

${netwerkTekst}

${bouwjaarKarakter}

Met een gemiddeld dakoppervlak van 40–60 m² en een jaarlijkse opbrengst van 900–1.100 kWh per geïnstalleerd kWp is de businesscase voor zonnepanelen in ${wijk} sterk. Een investering van €6.000–€9.000 levert bij huidige tarieven een terugverdientijd van 7–10 jaar — maar die rekensommen veranderen drastisch na 2027. Wie nú handelt, pakt nog drie volle salderingsjaren mee.

Bereken uw persoonlijke ROI via de gratis SaldeerScan op deze pagina. U heeft in vijf minuten uitsluitsel over het dakpotentieel, de exacte besparing en de optimale systeemgrootte voor uw woning in ${wijk}.`,
    faqItems: [
      {
        vraag: `Wanneer eindigt het salderen voor woningen in ${wijk}?`,
        antwoord: `Het salderingsstelsel eindigt voor alle Nederlandse woningbezitters op 1 januari 2027. Huiseigenaren in ${wijk} die vóór die datum zonnepanelen installeren, profiteren nog tot de einddatum van volledige saldering. Na 2027 ontvangt u nog slechts het lage teruglevertarief van uw energieleverancier.`,
      },
      {
        vraag: `Zijn woningen in ${wijk} geschikt voor zonnepanelen?`,
        antwoord: `${bouwjaarKarakter} Een gratis SaldeerScan geeft op basis van uw daktype, oriëntatie en bouwjaar in vijf minuten uitsluitsel over het individuele potentieel.`,
      },
      {
        vraag: `Wat is de netcongestiestatus in ${wijk}?`,
        antwoord: `De huidige netcongestiestatus voor ${wijk} is ${netcongestie}. ${netwerkTekst} Via de SaldeerScan ziet u welke combinatie van zonnepanelen en eventuele batterijopslag voor uw adres het meest rendabel is.`,
      },
    ],
  }
}

// ─── Seeder ────────────────────────────────────────────────────────────────

async function seedWijk(
  e: WijkEntry,
  opts: { rich: boolean; status: 'published' | 'draft'; skipExisting?: boolean }
) {
  const slug = `/${e.provincie}/${toSlug(e.stad)}/${toSlug(e.wijk)}`

  if (opts.skipExisting) {
    const { data } = await supabase.from('pseo_pages').select('slug').eq('slug', slug).maybeSingle()
    if (data) {
      process.stdout.write(`    SKIP  ${slug}\n`)
      return 'skipped' as const
    }
  }

  const content = opts.rich
    ? await generateRichContent(e)
    : generateTemplateContent(e)

  const healthScore = deriveHealthScore(e.bouwjaar, e.netcongestie)
  const jsonLd = buildJsonLd(e, content.titel, content.metaDescription)

  const { error } = await supabase.from('pseo_pages').upsert(
    {
      slug,
      provincie: e.provincie,
      stad:      toSlug(e.stad),
      wijk:      toSlug(e.wijk),
      straat:    null,
      titel:             content.titel,
      meta_description:  content.metaDescription,
      hoofdtekst:        content.hoofdtekst,
      faq_items:         content.faqItems,
      json_ld:           jsonLd,
      gem_bouwjaar:      e.bouwjaar,
      gem_health_score:  healthScore,
      netcongestie_status: e.netcongestie,
      status:            opts.status,
      generated_at:      new Date().toISOString(),
      revalidate_at:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: 'slug' }
  )

  if (error) {
    process.stdout.write(`  FOUT  ${slug}: ${error.message}\n`)
    return 'error' as const
  }

  process.stdout.write(`  ✓ [${opts.status.padEnd(9)}] ${slug}\n`)
  return 'ok' as const
}

// ─── Golden Batch — Top 27 focus-wijken ────────────────────────────────────
// Prioriteitscriteria: hoog aandeel nieuwbouw (2000+), grote omvang,
// hoge SEO-zoekvolumes, spreiding over alle 12 provincies.

const GOLDEN_BATCH: WijkEntry[] = [
  // Utrecht (2)
  { wijk: 'Leidsche Rijn',   stad: 'Utrecht',          provincie: 'utrecht',        bouwjaar: 2001, netcongestie: 'ORANJE' },
  { wijk: 'Vathorst',        stad: 'Amersfoort',        provincie: 'utrecht',        bouwjaar: 2002, netcongestie: 'ORANJE' },
  // Overijssel (2)
  { wijk: 'Stadshagen',      stad: 'Zwolle',            provincie: 'overijssel',     bouwjaar: 1998, netcongestie: 'ORANJE' },
  { wijk: 'Berkum',          stad: 'Zwolle',            provincie: 'overijssel',     bouwjaar: 2004, netcongestie: 'ORANJE' },
  // Noord-Holland (2)
  { wijk: 'IJburg',          stad: 'Amsterdam',         provincie: 'noord-holland',  bouwjaar: 2004, netcongestie: 'ROOD'   },
  { wijk: 'Getsewoud',       stad: 'Haarlemmermeer',    provincie: 'noord-holland',  bouwjaar: 2002, netcongestie: 'ORANJE' },
  // Flevoland (2)
  { wijk: 'Nobelhorst',      stad: 'Almere',            provincie: 'flevoland',      bouwjaar: 2009, netcongestie: 'GROEN'  },
  { wijk: 'Poort',           stad: 'Almere',            provincie: 'flevoland',      bouwjaar: 2005, netcongestie: 'GROEN'  },
  // Noord-Brabant (5)
  { wijk: 'Reeshof',         stad: 'Tilburg',           provincie: 'noord-brabant',  bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'Haagse Beemden',  stad: 'Breda',             provincie: 'noord-brabant',  bouwjaar: 1988, netcongestie: 'GROEN'  },
  { wijk: 'Brandevoort',     stad: 'Helmond',           provincie: 'noord-brabant',  bouwjaar: 2003, netcongestie: 'ORANJE' },
  { wijk: 'Meerhoven',       stad: 'Eindhoven',         provincie: 'noord-brabant',  bouwjaar: 2004, netcongestie: 'ORANJE' },
  { wijk: 'De Markiezaten',  stad: 'Bergen op Zoom',    provincie: 'noord-brabant',  bouwjaar: 2005, netcongestie: 'GROEN'  },
  // Zuid-Holland (5)
  { wijk: 'Ypenburg',        stad: 'Den Haag',          provincie: 'zuid-holland',   bouwjaar: 1999, netcongestie: 'ORANJE' },
  { wijk: 'Leidschenveen',   stad: 'Den Haag',          provincie: 'zuid-holland',   bouwjaar: 2003, netcongestie: 'ORANJE' },
  { wijk: 'Wilderszijde',    stad: 'Lansingerland',     provincie: 'zuid-holland',   bouwjaar: 2008, netcongestie: 'ORANJE' },
  { wijk: 'Stevenshof',      stad: 'Leiden',            provincie: 'zuid-holland',   bouwjaar: 1985, netcongestie: 'ORANJE' },
  { wijk: 'Oosterheem',      stad: 'Zoetermeer',        provincie: 'zuid-holland',   bouwjaar: 2004, netcongestie: 'ORANJE' },
  { wijk: 'Stadswerven',     stad: 'Dordrecht',         provincie: 'zuid-holland',   bouwjaar: 2015, netcongestie: 'ROOD'   },
  // Gelderland (3)
  { wijk: 'Schuytgraaf',     stad: 'Arnhem',            provincie: 'gelderland',     bouwjaar: 2005, netcongestie: 'ORANJE' },
  { wijk: 'Waalsprong',      stad: 'Nijmegen',          provincie: 'gelderland',     bouwjaar: 2004, netcongestie: 'ORANJE' },
  { wijk: 'Zuidbroek',       stad: 'Apeldoorn',         provincie: 'gelderland',     bouwjaar: 2006, netcongestie: 'GROEN'  },
  // Groningen (1)
  { wijk: 'Meerstad',        stad: 'Groningen',         provincie: 'groningen',      bouwjaar: 2010, netcongestie: 'GROEN'  },
  // Friesland (2)
  { wijk: 'Skoatterwâld',    stad: 'Heerenveen',        provincie: 'friesland',      bouwjaar: 2005, netcongestie: 'GROEN'  },
  { wijk: 'Zuiderburen',     stad: 'Leeuwarden',        provincie: 'friesland',      bouwjaar: 2008, netcongestie: 'GROEN'  },
  // Drenthe (1)
  { wijk: 'Kloosterveen',    stad: 'Assen',             provincie: 'drenthe',        bouwjaar: 2002, netcongestie: 'GROEN'  },
  // Utrecht provincie — extra (1)
  { wijk: 'Castellum',       stad: 'Houten',            provincie: 'utrecht',        bouwjaar: 2005, netcongestie: 'ORANJE' },
]

// ─── Extended Batch — ~150 representatieve wijken (draft, geen AI) ─────────
// Vul aan via CBS WFS voor de volledige 2000-batch (zie TODO in bestandskop).

const EXTENDED_BATCH: WijkEntry[] = [
  // Amsterdam
  { wijk: 'Bijlmer-Centrum',        stad: 'Amsterdam',           provincie: 'noord-holland',  bouwjaar: 2000, netcongestie: 'ROOD'   },
  { wijk: 'Bijlmer-Oost',           stad: 'Amsterdam',           provincie: 'noord-holland',  bouwjaar: 2001, netcongestie: 'ROOD'   },
  { wijk: 'Gaasperdam',             stad: 'Amsterdam',           provincie: 'noord-holland',  bouwjaar: 1985, netcongestie: 'ROOD'   },
  { wijk: 'De Aker',                stad: 'Amsterdam',           provincie: 'noord-holland',  bouwjaar: 1997, netcongestie: 'ROOD'   },
  { wijk: 'Osdorp',                 stad: 'Amsterdam',           provincie: 'noord-holland',  bouwjaar: 1965, netcongestie: 'ROOD'   },
  { wijk: 'Geuzenveld',             stad: 'Amsterdam',           provincie: 'noord-holland',  bouwjaar: 1960, netcongestie: 'ROOD'   },
  // Rotterdam
  { wijk: 'Prins Alexander',        stad: 'Rotterdam',           provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ROOD'   },
  { wijk: 'Ommoord',                stad: 'Rotterdam',           provincie: 'zuid-holland',   bouwjaar: 1972, netcongestie: 'ORANJE' },
  { wijk: 'Nesselande',             stad: 'Rotterdam',           provincie: 'zuid-holland',   bouwjaar: 2001, netcongestie: 'ORANJE' },
  { wijk: 'Beverwaard',             stad: 'Rotterdam',           provincie: 'zuid-holland',   bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Pendrecht',              stad: 'Rotterdam',           provincie: 'zuid-holland',   bouwjaar: 1953, netcongestie: 'GROEN'  },
  { wijk: 'Lombardijen',            stad: 'Rotterdam',           provincie: 'zuid-holland',   bouwjaar: 1968, netcongestie: 'GROEN'  },
  // Den Haag extra
  { wijk: 'Escamp',                 stad: 'Den Haag',            provincie: 'zuid-holland',   bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Morgenstond',            stad: 'Den Haag',            provincie: 'zuid-holland',   bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Moerwijk',               stad: 'Den Haag',            provincie: 'zuid-holland',   bouwjaar: 1952, netcongestie: 'ORANJE' },
  { wijk: 'Wateringse Veld',        stad: 'Den Haag',            provincie: 'zuid-holland',   bouwjaar: 1998, netcongestie: 'ORANJE' },
  // Utrecht extra
  { wijk: 'Overvecht',              stad: 'Utrecht',             provincie: 'utrecht',        bouwjaar: 1966, netcongestie: 'ORANJE' },
  { wijk: 'Kanaleneiland',          stad: 'Utrecht',             provincie: 'utrecht',        bouwjaar: 1962, netcongestie: 'ORANJE' },
  { wijk: 'Lunetten',               stad: 'Utrecht',             provincie: 'utrecht',        bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Vleuten-De Meern',       stad: 'Utrecht',             provincie: 'utrecht',        bouwjaar: 2000, netcongestie: 'ORANJE' },
  // Eindhoven extra
  { wijk: 'Woensel-Noord',          stad: 'Eindhoven',           provincie: 'noord-brabant',  bouwjaar: 1955, netcongestie: 'ORANJE' },
  { wijk: 'Woensel-West',           stad: 'Eindhoven',           provincie: 'noord-brabant',  bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Tongelre',               stad: 'Eindhoven',           provincie: 'noord-brabant',  bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'Gestel',                 stad: 'Eindhoven',           provincie: 'noord-brabant',  bouwjaar: 1948, netcongestie: 'GROEN'  },
  // Tilburg extra
  { wijk: 'Groenewoud',             stad: 'Tilburg',             provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Stokhasselt',            stad: 'Tilburg',             provincie: 'noord-brabant',  bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Berkel-Enschot',         stad: 'Tilburg',             provincie: 'noord-brabant',  bouwjaar: 1985, netcongestie: 'GROEN'  },
  // Breda extra
  { wijk: 'Hoge Vugt',              stad: 'Breda',               provincie: 'noord-brabant',  bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'Tuinzigt',               stad: 'Breda',               provincie: 'noord-brabant',  bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Bavel',                  stad: 'Breda',               provincie: 'noord-brabant',  bouwjaar: 1980, netcongestie: 'GROEN'  },
  // Nijmegen extra
  { wijk: 'Dukenburg',              stad: 'Nijmegen',            provincie: 'gelderland',     bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Lindenholt',             stad: 'Nijmegen',            provincie: 'gelderland',     bouwjaar: 1979, netcongestie: 'ORANJE' },
  { wijk: 'Hatert',                 stad: 'Nijmegen',            provincie: 'gelderland',     bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Neerbosch-Oost',         stad: 'Nijmegen',            provincie: 'gelderland',     bouwjaar: 1965, netcongestie: 'ORANJE' },
  // Arnhem extra
  { wijk: 'Presikhaaf',             stad: 'Arnhem',              provincie: 'gelderland',     bouwjaar: 1958, netcongestie: 'ORANJE' },
  { wijk: 'Kronenburg',             stad: 'Arnhem',              provincie: 'gelderland',     bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Malburgen',              stad: 'Arnhem',              provincie: 'gelderland',     bouwjaar: 1951, netcongestie: 'ORANJE' },
  // Groningen extra
  { wijk: 'Selwerd',                stad: 'Groningen',           provincie: 'groningen',      bouwjaar: 1960, netcongestie: 'GROEN'  },
  { wijk: 'Paddepoel',              stad: 'Groningen',           provincie: 'groningen',      bouwjaar: 1965, netcongestie: 'GROEN'  },
  { wijk: 'Lewenborg',              stad: 'Groningen',           provincie: 'groningen',      bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Vinkhuizen',             stad: 'Groningen',           provincie: 'groningen',      bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Corpus den Hoorn',       stad: 'Groningen',           provincie: 'groningen',      bouwjaar: 1975, netcongestie: 'GROEN'  },
  // Enschede
  { wijk: 'Wesselerbrink',          stad: 'Enschede',            provincie: 'overijssel',     bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Stroinkslanden',         stad: 'Enschede',            provincie: 'overijssel',     bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Velve-Lindenhof',        stad: 'Enschede',            provincie: 'overijssel',     bouwjaar: 1960, netcongestie: 'GROEN'  },
  // Haarlem
  { wijk: 'Schalkwijk',             stad: 'Haarlem',             provincie: 'noord-holland',  bouwjaar: 1968, netcongestie: 'ORANJE' },
  { wijk: 'Meerwijk',               stad: 'Haarlem',             provincie: 'noord-holland',  bouwjaar: 1967, netcongestie: 'ORANJE' },
  // Almere extra
  { wijk: 'Almere Buiten-Centrum',  stad: 'Almere',              provincie: 'flevoland',      bouwjaar: 1987, netcongestie: 'GROEN'  },
  { wijk: 'Filmwijk',               stad: 'Almere',              provincie: 'flevoland',      bouwjaar: 1988, netcongestie: 'GROEN'  },
  { wijk: 'Literatuurwijk',         stad: 'Almere',              provincie: 'flevoland',      bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'De Wierden',             stad: 'Almere',              provincie: 'flevoland',      bouwjaar: 1998, netcongestie: 'GROEN'  },
  // Amersfoort extra
  { wijk: 'Nieuwland',              stad: 'Amersfoort',          provincie: 'utrecht',        bouwjaar: 1990, netcongestie: 'ORANJE' },
  { wijk: 'Kattenbroek',            stad: 'Amersfoort',          provincie: 'utrecht',        bouwjaar: 1993, netcongestie: 'ORANJE' },
  { wijk: 'Hoogland-West',          stad: 'Amersfoort',          provincie: 'utrecht',        bouwjaar: 2002, netcongestie: 'ORANJE' },
  // Dordrecht extra
  { wijk: 'Krispijn',               stad: 'Dordrecht',           provincie: 'zuid-holland',   bouwjaar: 1945, netcongestie: 'ORANJE' },
  { wijk: 'Wielwijk',               stad: 'Dordrecht',           provincie: 'zuid-holland',   bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Sterrenburg',            stad: 'Dordrecht',           provincie: 'zuid-holland',   bouwjaar: 1973, netcongestie: 'ORANJE' },
  // Leiden extra
  { wijk: 'Merenwijk',              stad: 'Leiden',              provincie: 'zuid-holland',   bouwjaar: 1975, netcongestie: 'ORANJE' },
  { wijk: 'Meerburg',               stad: 'Leiden',              provincie: 'zuid-holland',   bouwjaar: 2006, netcongestie: 'ORANJE' },
  { wijk: 'Roomburg',               stad: 'Leiden',              provincie: 'zuid-holland',   bouwjaar: 2001, netcongestie: 'ORANJE' },
  // Zoetermeer extra
  { wijk: 'Seghwaert',              stad: 'Zoetermeer',          provincie: 'zuid-holland',   bouwjaar: 1982, netcongestie: 'ORANJE' },
  { wijk: 'Meerzicht',              stad: 'Zoetermeer',          provincie: 'zuid-holland',   bouwjaar: 1984, netcongestie: 'ORANJE' },
  { wijk: 'Rokkeveen',              stad: 'Zoetermeer',          provincie: 'zuid-holland',   bouwjaar: 1990, netcongestie: 'ORANJE' },
  // Apeldoorn extra
  { wijk: 'Matenbuurt',             stad: 'Apeldoorn',           provincie: 'gelderland',     bouwjaar: 1973, netcongestie: 'GROEN'  },
  { wijk: 'Zevenhuizen',            stad: 'Apeldoorn',           provincie: 'gelderland',     bouwjaar: 1977, netcongestie: 'GROEN'  },
  { wijk: 'Osseveld',               stad: 'Apeldoorn',           provincie: 'gelderland',     bouwjaar: 1988, netcongestie: 'GROEN'  },
  // Deventer
  { wijk: 'Colmschate',             stad: 'Deventer',            provincie: 'overijssel',     bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Keizerslanden',          stad: 'Deventer',            provincie: 'overijssel',     bouwjaar: 1965, netcongestie: 'GROEN'  },
  // Zwolle extra
  { wijk: 'Holtenbroek',            stad: 'Zwolle',              provincie: 'overijssel',     bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Aa-landen',              stad: 'Zwolle',              provincie: 'overijssel',     bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Westenholte',            stad: 'Zwolle',              provincie: 'overijssel',     bouwjaar: 2005, netcongestie: 'ORANJE' },
  // Leeuwarden extra
  { wijk: 'Camminghaburen',         stad: 'Leeuwarden',          provincie: 'friesland',      bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'De Vlietlanden',         stad: 'Leeuwarden',          provincie: 'friesland',      bouwjaar: 1985, netcongestie: 'GROEN'  },
  // Assen extra
  { wijk: 'Pittelo',                stad: 'Assen',               provincie: 'drenthe',        bouwjaar: 1972, netcongestie: 'GROEN'  },
  { wijk: 'Peelo',                  stad: 'Assen',               provincie: 'drenthe',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Marsdijk',               stad: 'Assen',               provincie: 'drenthe',        bouwjaar: 1980, netcongestie: 'GROEN'  },
  // Helmond extra
  { wijk: 'Rijpelberg',             stad: 'Helmond',             provincie: 'noord-brabant',  bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Mierlo-Hout',            stad: 'Helmond',             provincie: 'noord-brabant',  bouwjaar: 1972, netcongestie: 'GROEN'  },
  // 's-Hertogenbosch
  { wijk: 'Maaspoort',              stad: 's-Hertogenbosch',     provincie: 'noord-brabant',  bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'De Vliert',              stad: 's-Hertogenbosch',     provincie: 'noord-brabant',  bouwjaar: 1980, netcongestie: 'ORANJE' },
  { wijk: 'Rosmalen-Noord',         stad: 's-Hertogenbosch',     provincie: 'noord-brabant',  bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Empel',                  stad: 's-Hertogenbosch',     provincie: 'noord-brabant',  bouwjaar: 2002, netcongestie: 'ORANJE' },
  // Maastricht
  { wijk: 'Nazareth',               stad: 'Maastricht',          provincie: 'limburg',        bouwjaar: 1963, netcongestie: 'ORANJE' },
  { wijk: 'Malberg',                stad: 'Maastricht',          provincie: 'limburg',        bouwjaar: 1969, netcongestie: 'ORANJE' },
  { wijk: 'Wittevrouwenveld',       stad: 'Maastricht',          provincie: 'limburg',        bouwjaar: 1975, netcongestie: 'ORANJE' },
  // Heerlen
  { wijk: 'Meezenbroek',            stad: 'Heerlen',             provincie: 'limburg',        bouwjaar: 1960, netcongestie: 'ORANJE' },
  { wijk: 'Heerlerbaan',            stad: 'Heerlen',             provincie: 'limburg',        bouwjaar: 1965, netcongestie: 'ORANJE' },
  // Sittard-Geleen
  { wijk: 'Born',                   stad: 'Sittard-Geleen',      provincie: 'limburg',        bouwjaar: 1975, netcongestie: 'GROEN'  },
  // Middelburg
  { wijk: 'Dauwendaele',            stad: 'Middelburg',          provincie: 'zeeland',        bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Stromenwijk',            stad: 'Middelburg',          provincie: 'zeeland',        bouwjaar: 1995, netcongestie: 'GROEN'  },
  // Roosendaal
  { wijk: 'Kortendijk',             stad: 'Roosendaal',          provincie: 'noord-brabant',  bouwjaar: 1978, netcongestie: 'GROEN'  },
  { wijk: 'Westrand',               stad: 'Roosendaal',          provincie: 'noord-brabant',  bouwjaar: 1985, netcongestie: 'GROEN'  },
  // Bergen op Zoom extra
  { wijk: 'Gageldonk-West',         stad: 'Bergen op Zoom',      provincie: 'noord-brabant',  bouwjaar: 2002, netcongestie: 'GROEN'  },
  // Lelystad
  { wijk: 'Boswijk',                stad: 'Lelystad',            provincie: 'flevoland',      bouwjaar: 1996, netcongestie: 'GROEN'  },
  { wijk: 'Warande',                stad: 'Lelystad',            provincie: 'flevoland',      bouwjaar: 2000, netcongestie: 'GROEN'  },
  { wijk: 'Zuiderzeewijk',          stad: 'Lelystad',            provincie: 'flevoland',      bouwjaar: 2003, netcongestie: 'GROEN'  },
  // Emmen
  { wijk: 'Emmerhout',              stad: 'Emmen',               provincie: 'drenthe',        bouwjaar: 1966, netcongestie: 'GROEN'  },
  { wijk: 'Bargeres',               stad: 'Emmen',               provincie: 'drenthe',        bouwjaar: 1970, netcongestie: 'GROEN'  },
  // Zaandam
  { wijk: 'Poelenburg',             stad: 'Zaandam',             provincie: 'noord-holland',  bouwjaar: 1965, netcongestie: 'ORANJE' },
  { wijk: 'Kogerveld',              stad: 'Zaandam',             provincie: 'noord-holland',  bouwjaar: 1970, netcongestie: 'ORANJE' },
  // Alkmaar
  { wijk: 'Overdie',                stad: 'Alkmaar',             provincie: 'noord-holland',  bouwjaar: 1958, netcongestie: 'GROEN'  },
  { wijk: 'Vroonermeer',            stad: 'Alkmaar',             provincie: 'noord-holland',  bouwjaar: 1986, netcongestie: 'GROEN'  },
  { wijk: 'De Mare',                stad: 'Alkmaar',             provincie: 'noord-holland',  bouwjaar: 1997, netcongestie: 'GROEN'  },
  // Hoorn
  { wijk: 'Kersenboogerd',          stad: 'Hoorn',               provincie: 'noord-holland',  bouwjaar: 1988, netcongestie: 'GROEN'  },
  { wijk: 'Bangert-Oosterpolder',   stad: 'Hoorn',               provincie: 'noord-holland',  bouwjaar: 2005, netcongestie: 'GROEN'  },
  // Purmerend
  { wijk: 'Wheermolen',             stad: 'Purmerend',           provincie: 'noord-holland',  bouwjaar: 1978, netcongestie: 'ORANJE' },
  { wijk: 'Weidevenne',             stad: 'Purmerend',           provincie: 'noord-holland',  bouwjaar: 2001, netcongestie: 'ORANJE' },
  // Delft
  { wijk: 'Tanthof',                stad: 'Delft',               provincie: 'zuid-holland',   bouwjaar: 1981, netcongestie: 'ORANJE' },
  { wijk: 'Voorhof',                stad: 'Delft',               provincie: 'zuid-holland',   bouwjaar: 1970, netcongestie: 'ORANJE' },
  { wijk: 'Hof van Delft',          stad: 'Delft',               provincie: 'zuid-holland',   bouwjaar: 2004, netcongestie: 'ORANJE' },
  // Schiedam
  { wijk: 'Groenoord',              stad: 'Schiedam',            provincie: 'zuid-holland',   bouwjaar: 1969, netcongestie: 'ORANJE' },
  { wijk: 'Woudhoek',               stad: 'Schiedam',            provincie: 'zuid-holland',   bouwjaar: 1978, netcongestie: 'ORANJE' },
  // Vlaardingen
  { wijk: 'Holy-Noord',             stad: 'Vlaardingen',         provincie: 'zuid-holland',   bouwjaar: 1967, netcongestie: 'ORANJE' },
  { wijk: 'Westwijk',               stad: 'Vlaardingen',         provincie: 'zuid-holland',   bouwjaar: 1972, netcongestie: 'ORANJE' },
  // Capelle aan den IJssel
  { wijk: 'Middelwatering',         stad: 'Capelle aan den IJssel', provincie: 'zuid-holland', bouwjaar: 1972, netcongestie: 'ORANJE' },
  { wijk: 'Oostgaarde',             stad: 'Capelle aan den IJssel', provincie: 'zuid-holland', bouwjaar: 1975, netcongestie: 'ORANJE' },
  // Nissewaard (Spijkenisse)
  { wijk: 'Waterland',              stad: 'Nissewaard',          provincie: 'zuid-holland',   bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Maaswijk',               stad: 'Nissewaard',          provincie: 'zuid-holland',   bouwjaar: 1978, netcongestie: 'GROEN'  },
  // Gouda
  { wijk: 'Goverwelle',             stad: 'Gouda',               provincie: 'zuid-holland',   bouwjaar: 1995, netcongestie: 'GROEN'  },
  { wijk: 'Bloemendaal',            stad: 'Gouda',               provincie: 'zuid-holland',   bouwjaar: 1972, netcongestie: 'GROEN'  },
  // Alphen aan den Rijn
  { wijk: 'Ridderveld',             stad: 'Alphen aan den Rijn', provincie: 'zuid-holland',   bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Zwammerdam',             stad: 'Alphen aan den Rijn', provincie: 'zuid-holland',   bouwjaar: 2001, netcongestie: 'GROEN'  },
  // Nieuwegein
  { wijk: 'Jutphaas-Wijkersloot',   stad: 'Nieuwegein',          provincie: 'utrecht',        bouwjaar: 1974, netcongestie: 'ORANJE' },
  { wijk: 'Batau-Noord',            stad: 'Nieuwegein',          provincie: 'utrecht',        bouwjaar: 1976, netcongestie: 'ORANJE' },
  // Veenendaal
  { wijk: 'De Dragonder',           stad: 'Veenendaal',          provincie: 'utrecht',        bouwjaar: 1985, netcongestie: 'GROEN'  },
  { wijk: 'Schrijverswijk',         stad: 'Veenendaal',          provincie: 'utrecht',        bouwjaar: 2000, netcongestie: 'GROEN'  },
  // Gelderland extra
  { wijk: 'Doornsteeg',             stad: 'Nijkerk',             provincie: 'gelderland',     bouwjaar: 2001, netcongestie: 'GROEN'  },
  { wijk: 'Groenenstein',           stad: 'Barneveld',           provincie: 'gelderland',     bouwjaar: 2000, netcongestie: 'GROEN'  },
  { wijk: 'De Valk',                stad: 'Ede',                 provincie: 'gelderland',     bouwjaar: 1995, netcongestie: 'GROEN'  },
  { wijk: 'Veldhuizen',             stad: 'Ede',                 provincie: 'gelderland',     bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Tarthorst',              stad: 'Wageningen',          provincie: 'gelderland',     bouwjaar: 1970, netcongestie: 'GROEN'  },
  { wijk: 'Passewaaij',             stad: 'Tiel',                provincie: 'gelderland',     bouwjaar: 1997, netcongestie: 'GROEN'  },
  { wijk: 'De Hoven',               stad: 'Zutphen',             provincie: 'gelderland',     bouwjaar: 1969, netcongestie: 'GROEN'  },
  { wijk: 'De Huet',                stad: 'Doetinchem',          provincie: 'gelderland',     bouwjaar: 1975, netcongestie: 'GROEN'  },
  // Zeeland extra
  { wijk: 'Dauwendaele-Noord',      stad: 'Middelburg',          provincie: 'zeeland',        bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'De Goese Meer',          stad: 'Goes',                provincie: 'zeeland',        bouwjaar: 2005, netcongestie: 'GROEN'  },
  // Friesland extra
  { wijk: 'Wielenpoel',             stad: 'Leeuwarden',          provincie: 'friesland',      bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Heechterp',              stad: 'Leeuwarden',          provincie: 'friesland',      bouwjaar: 1969, netcongestie: 'GROEN'  },
  // Groningen extra
  { wijk: 'Gravenburg',             stad: 'Groningen',           provincie: 'groningen',      bouwjaar: 1980, netcongestie: 'GROEN'  },
  { wijk: 'Hoogkerk',               stad: 'Groningen',           provincie: 'groningen',      bouwjaar: 1975, netcongestie: 'GROEN'  },
  // Drenthe extra
  { wijk: 'Angelslo',               stad: 'Emmen',               provincie: 'drenthe',        bouwjaar: 1968, netcongestie: 'GROEN'  },
  { wijk: 'Rietlanden',             stad: 'Meppel',              provincie: 'drenthe',        bouwjaar: 1998, netcongestie: 'GROEN'  },
  // Overijssel extra
  { wijk: 'Schalkhaar',             stad: 'Deventer',            provincie: 'overijssel',     bouwjaar: 1990, netcongestie: 'GROEN'  },
  { wijk: 'Deppenbroek',            stad: 'Enschede',            provincie: 'overijssel',     bouwjaar: 1975, netcongestie: 'GROEN'  },
  { wijk: 'Pathmos',                stad: 'Enschede',            provincie: 'overijssel',     bouwjaar: 1958, netcongestie: 'GROEN'  },
]

// ─── Main ──────────────────────────────────────────────────────────────────

async function run() {
  const onlyGolden = process.argv.includes('--only-golden')
  const dryRun     = process.argv.includes('--dry-run')
  const preview    = process.argv.includes('--preview')

  // Preview: toon template-content voor eerste 2 Golden wijken, geen DB
  if (preview) {
    for (const e of GOLDEN_BATCH.slice(0, 2)) {
      const c = generateTemplateContent(e)
      const score = deriveHealthScore(e.bouwjaar, e.netcongestie)
      console.log(`\n${'═'.repeat(60)}`)
      console.log(`PREVIEW: ${e.wijk}, ${e.stad} (score ${score}, ${e.netcongestie})`)
      console.log('═'.repeat(60))
      console.log(`Titel:   ${c.titel}`)
      console.log(`Meta:    ${c.metaDescription}`)
      console.log(`\nHoofdtekst (eerste 300 tekens):\n${c.hoofdtekst.slice(0, 300)}…`)
      console.log(`\nFAQ #1: ${c.faqItems[0].vraag}`)
      console.log(`        ${c.faqItems[0].antwoord.slice(0, 120)}…`)
    }
    console.log('\n(--preview toont template-content; live run gebruikt rijke Gemini AI-content)\n')
    return
  }

  console.log('\nSaldeerScan.nl — pSEO Wijk Seeder')
  console.log(`Modus:  ${onlyGolden ? 'alleen Golden Batch' : 'Golden + Extended'}${dryRun ? ' [DRY RUN]' : ''}`)
  console.log(`Golden: ${GOLDEN_BATCH.length} wijken → published`)
  if (!onlyGolden) console.log(`Extended: ${EXTENDED_BATCH.length} wijken → draft`)
  console.log('─'.repeat(55) + '\n')

  // ── Fase 1: Golden Batch ──────────────────────────────────
  console.log(`▶ Fase 1 — Golden Batch (${GOLDEN_BATCH.length} wijken, Gemini AI)\n`)
  let g = { ok: 0, fail: 0 }

  for (const entry of GOLDEN_BATCH) {
    if (dryRun) {
      console.log(`  DRY   /${entry.provincie}/${toSlug(entry.stad)}/${toSlug(entry.wijk)}`)
      g.ok++
      continue
    }
    try {
      const result = await seedWijk(entry, { rich: true, status: 'published' })
      if (result !== 'error') g.ok++; else g.fail++
    } catch (err) {
      console.error(`  FOUT  ${entry.wijk}: ${err instanceof Error ? err.message : String(err)}`)
      g.fail++
    }
    await sleep(1500) // Gemini rate limiting
  }

  console.log(`\n  ✓ ${g.ok} gepubliceerd${g.fail > 0 ? `, ${g.fail} fouten` : ''}\n`)

  if (onlyGolden) {
    console.log('Klaar — extended batch overgeslagen (--only-golden).\n')
    console.log(`Totaal: ${g.ok} wijken gepubliceerd in Supabase.\n`)
    return
  }

  // ── Fase 2: Extended Batch ────────────────────────────────
  console.log(`▶ Fase 2 — Extended Batch (${EXTENDED_BATCH.length} wijken, template)\n`)

  const goldenSlugs = new Set(
    GOLDEN_BATCH.map(e => `/${e.provincie}/${toSlug(e.stad)}/${toSlug(e.wijk)}`)
  )

  const BATCH_SIZE = 50
  let e2 = { ok: 0, skip: 0, fail: 0 }

  for (let i = 0; i < EXTENDED_BATCH.length; i += BATCH_SIZE) {
    const batch = EXTENDED_BATCH.slice(i, i + BATCH_SIZE)
    const batchNr = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(EXTENDED_BATCH.length / BATCH_SIZE)
    console.log(`  Batch ${batchNr}/${totalBatches}`)

    for (const entry of batch) {
      const slug = `/${entry.provincie}/${toSlug(entry.stad)}/${toSlug(entry.wijk)}`

      if (goldenSlugs.has(slug)) {
        process.stdout.write(`    SKIP  ${slug} (al in golden)\n`)
        e2.skip++
        continue
      }

      if (dryRun) {
        process.stdout.write(`    DRY   ${slug}\n`)
        e2.ok++
        continue
      }

      try {
        const result = await seedWijk(entry, { rich: false, status: 'draft', skipExisting: true })
        if (result === 'skipped') e2.skip++
        else if (result === 'error') e2.fail++
        else e2.ok++
      } catch (err) {
        process.stdout.write(`    FOUT  ${entry.wijk}: ${err instanceof Error ? err.message : String(err)}\n`)
        e2.fail++
      }
      await sleep(40) // DB rate limiting voor bulk writes
    }

    if (i + BATCH_SIZE < EXTENDED_BATCH.length) {
      process.stdout.write('  ↺ wacht 1s...\n')
      await sleep(1000)
    }
  }

  console.log(`\n  ✓ ${e2.ok} draft opgeslagen, ${e2.skip} overgeslagen${e2.fail > 0 ? `, ${e2.fail} fouten` : ''}\n`)

  const totaal = g.ok + e2.ok
  console.log('─'.repeat(55))
  console.log(`Gereed. Totaal: ${totaal} wijken in Supabase`)
  console.log(`  ${g.ok} gepubliceerd (golden) + ${e2.ok} draft (extended)\n`)
  console.log('Draft publiceren:')
  console.log("  UPDATE pseo_pages SET status = 'published' WHERE status = 'draft';\n")
}

run().catch(err => {
  console.error('\nFatale fout:', err)
  process.exit(1)
})
