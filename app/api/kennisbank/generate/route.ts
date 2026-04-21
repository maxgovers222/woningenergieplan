import { generateKennisbankContent } from '@/lib/gemini'
import { notifyGoogleIndexing } from '@/lib/google-indexing'
import { buildArticleSchema } from '@/lib/json-ld'
import { getAllKennisbankSlugs, upsertKennisbankArticle } from '@/lib/kennisbank'

export async function POST(request: Request) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const slug = body?.slug as string | undefined
  if (!slug || typeof slug !== 'string') {
    return Response.json({ error: 'slug vereist' }, { status: 400 })
  }

  const allSlugs = await getAllKennisbankSlugs()

  const content = await generateKennisbankContent({ slug, allSlugs })
  const now = new Date().toISOString()
  const jsonLd = buildArticleSchema({
    slug,
    titel: content.titel,
    metaDescription: content.metaDescription ?? '',
    publishedAt: now,
    type: 'kennisbank',
    faqItems: content.faqItems,
  })

  await upsertKennisbankArticle({
    slug,
    titel: content.titel,
    metaDescription: content.metaDescription ?? '',
    intro: content.intro ?? '',
    hoofdtekst: content.hoofdtekst,
    faqItems: content.faqItems,
    jsonLd,
    category: content.category ?? 'algemeen',
    relatedSlugs: content.relatedSlugs ?? [],
    status: 'published',
  })

  await notifyGoogleIndexing(`https://saldeerscan.nl/kennisbank/${slug}`).catch(() => {})

  return Response.json({ ok: true, slug })
}
