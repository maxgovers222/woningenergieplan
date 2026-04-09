// scripts/seed-pseo.ts
// Run with: npx tsx scripts/seed-pseo.ts
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as dotenv from 'dotenv'
import { buildLocalBusinessSchema } from '../lib/json-ld'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Sample streets to seed (in production, load from BAG/CBS data)
const SAMPLE_PAGES = [
  { provincie: 'Noord-Holland', stad: 'Amsterdam', wijk: 'centrum', straat: 'prinsengracht', postcode_prefix: '1015', gem_bouwjaar: 1890, netcongestie: 'ROOD' as const },
  { provincie: 'Zuid-Holland', stad: 'Rotterdam', wijk: 'feijenoord', straat: 'lombardstraat', postcode_prefix: '3031', gem_bouwjaar: 1955, netcongestie: 'ROOD' as const },
  { provincie: 'Utrecht', stad: 'Utrecht', wijk: 'oost', straat: 'biltstraat', postcode_prefix: '3572', gem_bouwjaar: 1970, netcongestie: 'ORANJE' as const },
  { provincie: 'Noord-Brabant', stad: 'Eindhoven', wijk: 'strijp', straat: 'kastanjelaan', postcode_prefix: '5616', gem_bouwjaar: 1975, netcongestie: 'ORANJE' as const },
  { provincie: 'Gelderland', stad: 'Arnhem', wijk: 'presikhaaf', straat: 'groningensingel', postcode_prefix: '6835', gem_bouwjaar: 1965, netcongestie: 'GROEN' as const },
]

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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

seed().catch(console.error)
