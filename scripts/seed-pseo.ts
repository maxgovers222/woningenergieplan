// scripts/seed-pseo.ts
// Run with: npx tsx scripts/seed-pseo.ts [--skip-existing] [--dry-run]
// PDOK mode: npx tsx scripts/seed-pseo.ts --wijk=centrum --stad=Amsterdam --provincie=Noord-Holland [--batch=0,20] [--dry-run]
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as dotenv from 'dotenv'
import { buildLocalBusinessSchema } from '../lib/json-ld'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Fetch top straten voor een gemeente via PDOK BAG WFS
async function getStratenFromPDOK(gemeente: string): Promise<Array<{ straat: string; aantalPanden: number }>> {
  const url = new URL('https://service.pdok.nl/lv/bag/wfs/v2_0')
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('version', '2.0.0')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('typeName', 'bag:verblijfsobject')
  url.searchParams.set('outputFormat', 'application/json')
  url.searchParams.set('CQL_FILTER', `gemeentenaam='${gemeente}' AND status='Verblijfsobject in gebruik'`)
  url.searchParams.set('propertyName', 'openbare_ruimte_naam')
  url.searchParams.set('count', '10000')

  console.log(`  PDOK BAG query voor ${gemeente}...`)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`PDOK error: ${res.status} ${res.statusText}`)
  const json = await res.json()

  const counts = new Map<string, number>()
  for (const f of json.features ?? []) {
    const naam = f.properties?.openbare_ruimte_naam
    if (naam && typeof naam === 'string') counts.set(naam, (counts.get(naam) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([straat, aantalPanden]) => ({ straat, aantalPanden }))
    .sort((a, b) => b.aantalPanden - a.aantalPanden)
    .slice(0, 100)
}

// Sample streets to seed (in production, load from BAG/CBS data)
const SAMPLE_PAGES = [
  { provincie: 'Noord-Holland', stad: 'Amsterdam', wijk: 'centrum', straat: 'prinsengracht', postcode_prefix: '1015', gem_bouwjaar: 1890, netcongestie: 'ROOD' as const },
  { provincie: 'Zuid-Holland', stad: 'Rotterdam', wijk: 'feijenoord', straat: 'lombardstraat', postcode_prefix: '3031', gem_bouwjaar: 1955, netcongestie: 'ROOD' as const },
  { provincie: 'Utrecht', stad: 'Utrecht', wijk: 'oost', straat: 'biltstraat', postcode_prefix: '3572', gem_bouwjaar: 1970, netcongestie: 'ORANJE' as const },
  { provincie: 'Noord-Brabant', stad: 'Eindhoven', wijk: 'strijp', straat: 'kastanjelaan', postcode_prefix: '5616', gem_bouwjaar: 1975, netcongestie: 'ORANJE' as const },
  { provincie: 'Gelderland', stad: 'Arnhem', wijk: 'presikhaaf', straat: 'groningensingel', postcode_prefix: '6835', gem_bouwjaar: 1965, netcongestie: 'GROEN' as const },
]

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

async function generateContent(page: typeof SAMPLE_PAGES[0]) {
  const prompt = `Schrijf een SEO-artikel van 600 woorden over energiebesparing voor SaldeerScan.nl.
Straat: ${page.straat}, ${page.stad}, ${page.provincie}
Bouwjaar woningen: ~${page.gem_bouwjaar}
Netcongestie: ${page.netcongestie}

Focus op het einde van salderen op 1 januari 2027. Schrijf voor Nederlandse huiseigenaren.

Geef SEO-titel (max 60 tekens), meta-description (max 155 tekens), hoofdtekst (600 woorden), en 3 FAQ items.

Return JSON:
{
  "titel": "...",
  "metaDescription": "...",
  "hoofdtekst": "...",
  "faqItems": [{"vraag": "...", "antwoord": "..."}, ...]
}`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in Gemini response')
  return JSON.parse(jsonMatch[0])
}


async function seed() {
  console.log(`Seeding ${SAMPLE_PAGES.length} pSEO pages...`)

  for (const page of SAMPLE_PAGES) {
    const slug = `/${page.provincie.toLowerCase().replace(/\s+/g, '-')}/${page.stad.toLowerCase()}/${page.wijk}/${page.straat}`
    console.log(`Generating content for ${slug}...`)

    try {
      const content = await generateContent(page)
      const jsonLd = buildLocalBusinessSchema({
        straat: page.straat,
        stad: page.stad,
        provincie: page.provincie,
        postcode: page.postcode_prefix,
        faqItems: content.faqItems ?? [],
      })

      const { error } = await supabase
        .from('pseo_pages')
        .upsert({
          slug,
          provincie: page.provincie,
          stad: page.stad,
          wijk: page.wijk,
          straat: page.straat,
          postcode_prefix: page.postcode_prefix,
          titel: content.titel,
          meta_description: content.metaDescription,
          hoofdtekst: content.hoofdtekst,
          faq_items: content.faqItems ?? [],
          json_ld: jsonLd,
          gem_bouwjaar: page.gem_bouwjaar,
          netcongestie_status: page.netcongestie,
          aantal_woningen: 150,
          status: 'published',
          generated_at: new Date().toISOString(),
        }, { onConflict: 'slug' })

      if (error) console.error(`Error seeding ${slug}:`, error.message)
      else console.log(`✓ Seeded ${slug}`)

      // Rate limit: 1 req/sec for Gemini free tier
      await new Promise(r => setTimeout(r, 1100))
    } catch (err) {
      console.error(`Failed ${slug}:`, err)
    }
  }

  console.log('Done seeding pSEO pages!')
}

async function seedPDOKWijk() {
  const wijkArg = process.argv.find(a => a.startsWith('--wijk='))?.split('=')[1]
  const stadArg = process.argv.find(a => a.startsWith('--stad='))?.split('=')[1]
  const provincieArg = process.argv.find(a => a.startsWith('--provincie='))?.split('=')[1]
  const batchArg = process.argv.find(a => a.startsWith('--batch='))?.split('=')[1]
  const skipExisting = process.argv.includes('--skip-existing')
  const dryRun = process.argv.includes('--dry-run')

  if (!wijkArg || !stadArg || !provincieArg) return false

  console.log(`\nPDOK mode: ${provincieArg}/${stadArg}/${wijkArg}`)
  if (dryRun) console.log('DRY RUN — geen DB writes')

  const straten = await getStratenFromPDOK(stadArg)
  console.log(`${straten.length} straten gevonden, top 10:`, straten.slice(0, 10).map(s => s.straat).join(', '))

  const [start, end] = batchArg ? batchArg.split(',').map(Number) : [0, 20]
  const batch = straten.slice(start, end)
  console.log(`Batch ${start}-${end}: ${batch.length} straten\n`)

  const provincieSlug = provincieArg.toLowerCase().replace(/\s+/g, '-')
  const stadSlug = stadArg.toLowerCase().replace(/\s+/g, '-')
  const wijkSlug = wijkArg.toLowerCase().replace(/\s+/g, '-')

  // Haal netcongestie_status op uit wijk-pagina
  const { data: wijkPage } = await supabase
    .from('pseo_pages')
    .select('netcongestie_status, gem_bouwjaar, postcode_prefix')
    .eq('stad', stadSlug)
    .eq('wijk', wijkSlug)
    .is('straat', null)
    .maybeSingle()

  const netcongestie = (wijkPage?.netcongestie_status ?? 'ORANJE') as 'ROOD' | 'ORANJE' | 'GROEN'
  const gemBouwjaar = wijkPage?.gem_bouwjaar ?? 1970
  const postcodePrefix = wijkPage?.postcode_prefix ?? '0000'

  for (const { straat, aantalPanden } of batch) {
    const straatSlug = straat.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const slug = `/${provincieSlug}/${stadSlug}/${wijkSlug}/${straatSlug}`

    if (skipExisting) {
      const { data: existing } = await supabase.from('pseo_pages').select('id').eq('slug', slug).maybeSingle()
      if (existing) { console.log(`  skip: ${straatSlug}`); continue }
    }

    console.log(`  genereren: ${straatSlug} (${aantalPanden} panden)...`)

    const page = { provincie: provincieArg, stad: stadArg, wijk: wijkSlug, straat: straatSlug, postcode_prefix: postcodePrefix, gem_bouwjaar: gemBouwjaar, netcongestie }

    if (!dryRun) {
      try {
        const content = await generateContent(page)
        const jsonLd = buildLocalBusinessSchema({ straat: straatSlug, stad: stadArg, provincie: provincieArg, postcode: postcodePrefix, faqItems: content.faqItems ?? [] })

        const { error } = await supabase.from('pseo_pages').upsert({
          slug, provincie: provincieSlug, stad: stadSlug, wijk: wijkSlug, straat: straatSlug,
          postcode_prefix: postcodePrefix, titel: content.titel, meta_description: content.metaDescription,
          hoofdtekst: content.hoofdtekst, faq_items: content.faqItems ?? [], json_ld: jsonLd,
          gem_bouwjaar: gemBouwjaar, netcongestie_status: netcongestie, aantal_woningen: aantalPanden,
          status: 'published', generated_at: new Date().toISOString(),
        }, { onConflict: 'slug' })

        if (error) console.error(`  ✗ ${straatSlug}:`, error.message)
        else console.log(`  ✓ ${straatSlug}`)
      } catch (err) {
        console.error(`  ✗ ${straatSlug}:`, err)
      }
      await new Promise(r => setTimeout(r, 1100))
    } else {
      console.log(`  [dry-run] ${straat}`)
    }
  }

  console.log('\nKlaar!')
  return true
}

async function main() {
  const pdokMode = await seedPDOKWijk()
  if (!pdokMode) await seed()
}

main().catch(console.error)
