import { generateNieuwsContent } from '@/lib/gemini'
import { notifyGoogleIndexing } from '@/lib/google-indexing'
import { buildArticleSchema } from '@/lib/json-ld'
import { getRecentNieuwsTitles, upsertNieuwsArticle } from '@/lib/nieuws'

const NIEUWS_TOPICS = [
  'Netcongestie kaart update: welke Nederlandse regio\'s zijn vol in 2026?',
  'Salderingsafbouw 2026: hoeveel verlies je per kwartaal?',
  'Thuisbatterij prijzen 2026: welke modellen zijn nu rendabel?',
  'SDE++ subsidie 2026: deadline en aanvraagprocedure voor zonnepanelen',
  'Slim energiecontract na 2027: welke opties zijn er voor zonnepaneelbezitters?',
  'Energieprijzen voorjaar 2026: wat betekent dit voor uw zonnepanelen rendement?',
  'Warmtepomp combineren met zonnepanelen: rendement en kosten in 2026',
  'Nieuwe netcongestie regels Liander: wat verandert er voor particulieren?',
  'Zonnepanelen reinigen 2026: wanneer loont het en wat kost het?',
  'Energiecoöperaties als alternatief voor saldering na 2027',
  'Postcoderoos regeling 2026: update voor bewoners zonder eigen dak',
  'Omvormer levensduur: wanneer moet u vervangen voor 2027?',
  'Thuisbatterij Victron vs Sonnen vs BYD: vergelijking 2026',
  'Energielabel C verplicht: impact op woningwaarde en zonnepanelen',
  'Stedin netcongestie update: nieuwe kaart en uitbreidingsplannen',
  'Zonnepanelen op plat dak 2026: opties, kosten en subsidie',
  'Dynamisch energiecontract 2026: voordelen en risico\'s voor zonnepaneelbezitters',
  'Saldering buren regeling: teruglevering aan de buurt als alternatief',
  'Eneco vs Vattenfall vs Tibber: beste contract na saldering 2027',
  'Laadpaal thuis combineren met zonnepanelen: terugverdientijd 2026',
  'Isolatie subsidie 2026: welke maatregelen zijn het meest rendabel?',
  'Zonnepaneel garantie 2026: wat dekt uw garantie en wanneer loopt die af?',
  'ISDE subsidie update 2026: aanvragen voor warmtepomp en isolatie',
  'Energie onafhankelijkheid 2027: hoe ver kunt u komen met zonnepanelen en batterij?',
  'Kleine windmolen tuin 2026: mag het en wat levert het op?',
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '')
}

export async function GET(request: Request) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const recentTitles = await getRecentNieuwsTitles(20)

  // Deterministic topic selection: rotate through list based on day of year
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const topicSeed = NIEUWS_TOPICS[dayOfYear % NIEUWS_TOPICS.length]

  const content = await generateNieuwsContent({ topicSeed, recentPublishedTitles: recentTitles })

  const baseSlug = slugify(content.slug || content.titel)
  const now = new Date().toISOString()

  const jsonLd = buildArticleSchema({
    slug: baseSlug,
    titel: content.titel,
    metaDescription: content.metaDescription ?? '',
    publishedAt: now,
    type: 'nieuws',
    faqItems: content.faqItems,
  })

  await upsertNieuwsArticle({
    slug: baseSlug,
    titel: content.titel,
    metaDescription: content.metaDescription ?? '',
    intro: content.intro ?? '',
    hoofdtekst: content.hoofdtekst,
    faqItems: content.faqItems,
    jsonLd,
    topicSeed,
    status: 'published',
    publishedAt: now,
  })

  await notifyGoogleIndexing(`https://saldeerscan.nl/nieuws/${baseSlug}`).catch(() => {})

  return Response.json({ ok: true, slug: baseSlug })
}
