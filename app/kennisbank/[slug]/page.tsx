import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getKennisbankArticle, getAllKennisbankSlugs, getAllPublishedKennisbank } from '@/lib/kennisbank'
import { LocalSchema } from '@/components/pseo/LocalSchema'
import { NavDark, FooterDark } from '@/components/NavDark'
import { RelatedWijken } from '@/components/pseo/RelatedWijken'

export const revalidate = 2592000

type Params = { slug: string }

export async function generateStaticParams() {
  try {
    const slugs = await getAllKennisbankSlugs()
    return slugs.map(slug => ({ slug }))
  } catch { return [] }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getKennisbankArticle(slug)
  if (!article) return {}
  return {
    title: `${article.titel} | SaldeerScan Kennisbank`,
    description: article.metaDescription ?? undefined,
    alternates: { canonical: `https://saldeerscan.nl/kennisbank/${slug}` },
    openGraph: {
      title: article.titel,
      description: article.metaDescription ?? undefined,
      type: 'article',
      locale: 'nl_NL',
      url: `https://saldeerscan.nl/kennisbank/${slug}`,
    },
  }
}

function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h2 key={i} className="font-heading text-xl text-white font-bold mt-8 mb-3">
          {renderInline(line.slice(3))}
        </h2>
      )
    }
    if (line.startsWith('### ')) {
      return (
        <h3 key={i} className="font-heading text-lg text-white font-semibold mt-6 mb-2">
          {renderInline(line.slice(4))}
        </h3>
      )
    }
    if (line.trim() === '') return <div key={i} className="h-3" />
    return (
      <p key={i} className="text-slate-300 leading-relaxed mb-2">
        {renderInline(line)}
      </p>
    )
  })
}

function renderInline(text: string) {
  const parts = text.split('**')
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="text-white font-semibold">{part}</strong>
      : part
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  saldering: 'Saldering',
  zonnepanelen: 'Zonnepanelen',
  netcongestie: 'Netcongestie',
  subsidie: 'Subsidie',
  algemeen: 'Algemeen',
}

export default async function KennisbankArtikel({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const [article, allArticles] = await Promise.all([
    getKennisbankArticle(slug),
    getAllPublishedKennisbank(),
  ])

  if (!article) notFound()

  const related = allArticles.filter(a =>
    article.relatedSlugs.includes(a.slug) && a.slug !== slug
  ).slice(0, 3)

  const publishedDate = article.generatedAt
    ? new Date(article.generatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <main className="min-h-screen bg-[#020617]">
      <LocalSchema jsonLd={article.jsonLd} />
      <NavDark />
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        <Link href="/" className="text-slate-500 hover:text-white transition-colors text-sm">Home</Link>
        <span className="text-slate-700">/</span>
        <Link href="/kennisbank" className="text-slate-500 hover:text-white transition-colors text-sm">Kennisbank</Link>
        <span className="text-slate-700">/</span>
        <span className="text-slate-300 text-sm truncate max-w-xs">{article.titel}</span>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Article body */}
          <article className="lg:col-span-8">
            {/* Meta */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/30">
                {CATEGORY_LABELS[article.category] ?? article.category}
              </span>
              {publishedDate && (
                <span className="text-slate-500 text-sm font-mono">{publishedDate}</span>
              )}
            </div>

            <h1 className="font-heading text-3xl md:text-4xl text-white font-bold leading-tight mb-6">
              {article.titel}
            </h1>

            {article.intro && (
              <p className="text-slate-300 text-lg leading-relaxed mb-8 border-l-2 border-amber-500/40 pl-4">
                {article.intro}
              </p>
            )}

            {article.hoofdtekst && (
              <div className="prose-article">
                {renderMarkdown(article.hoofdtekst)}
              </div>
            )}

            {/* FAQ */}
            {article.faqItems.length > 0 && (
              <section className="mt-12 border-t border-white/10 pt-8">
                <h2 className="font-heading text-2xl text-white font-bold mb-6">
                  Veelgestelde vragen
                </h2>
                <div className="space-y-4">
                  {article.faqItems.map((faq, i) => (
                    <details key={i} className="group bg-slate-900/40 border border-white/10 rounded-xl overflow-hidden">
                      <summary className="flex items-center justify-between px-5 py-4 cursor-pointer text-white font-medium select-none list-none">
                        {faq.vraag}
                        <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-5 pb-4 text-slate-300 leading-relaxed border-t border-white/5 pt-3">
                        {faq.antwoord}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Wijk interne linking */}
            <RelatedWijken limit={4} />
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            {/* CTA */}
            <div className="bg-amber-950/20 border border-amber-500/25 rounded-2xl p-6 sticky top-6">
              <h3 className="font-heading text-lg text-white font-bold mb-2">
                Wat betekent dit voor uw woning?
              </h3>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                Bereken gratis uw persoonlijke besparing en rendement met onze AI-analyse.
              </p>
              <Link
                href="/check"
                className="flex items-center justify-center gap-2 bg-amber-500 text-slate-950 font-semibold px-4 py-3 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:bg-amber-400 transition-colors text-sm w-full"
              >
                Gratis 2027-check starten
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Related articles */}
            {related.length > 0 && (
              <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-6">
                <h3 className="font-heading text-base text-white font-semibold mb-4">
                  Gerelateerde artikelen
                </h3>
                <ul className="space-y-3">
                  {related.map(rel => (
                    <li key={rel.slug}>
                      <Link
                        href={`/kennisbank/${rel.slug}`}
                        className="group flex items-start gap-2 text-slate-300 hover:text-amber-300 transition-colors text-sm"
                      >
                        <svg className="w-4 h-4 text-amber-500/60 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {rel.titel}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Kennisbank link */}
            <Link
              href="/kennisbank"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Alle kennisbank artikelen
            </Link>

            {/* CTA naar funnel */}
            <div className="mt-6 p-4 rounded-xl border border-amber-500/20 bg-amber-950/10">
              <p className="text-xs text-amber-300/70 uppercase tracking-wider mb-2">Gratis berekenen</p>
              <p className="text-sm text-slate-300 mb-3">
                Bekijk hoeveel uw woning bespaart vóór 2027.
              </p>
              <Link
                href="/check"
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors"
              >
                Bekijk uw woning
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </aside>
        </div>
      </div>
      <FooterDark />
    </main>
  )
}
