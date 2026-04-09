import { cache } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPseoPage, getTopPseoPages } from '@/lib/pseo'
import { LocalSchema } from '@/components/pseo/LocalSchema'

// Deduplicate Supabase fetches: generateMetadata + page component share one request
const getCachedPseoPage = cache(getPseoPage)

// ISR: revalidate every 30 days
export const revalidate = 2592000

type Params = { provincie: string; stad: string; wijk: string; straat: string }

export async function generateStaticParams() {
  try {
    const pages = await getTopPseoPages(500)
    return pages.map(p => ({
      provincie: p.provincie,
      stad: p.stad,
      wijk: p.wijk ?? 'centrum',
      straat: p.straat ?? 'onbekend',
    }))
  } catch {
    // DB not available at build time — ISR handles runtime generation
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const p = await params
  const page = await getCachedPseoPage(p)
  if (!page) return { title: 'Pagina niet gevonden' }

  return {
    title: page.titel ?? `Energiebesparing ${p.straat} ${p.stad}`,
    description: page.metaDescription ?? undefined,
    alternates: { canonical: `https://saldeerscan.nl${page.slug}` },
    openGraph: {
      title: page.titel ?? undefined,
      description: page.metaDescription ?? undefined,
      url: `https://saldeerscan.nl${page.slug}`,
      siteName: 'SaldeerScan.nl',
      locale: 'nl_NL',
      type: 'website',
    },
  }
}

export default async function PseoStreetPage({ params }: { params: Promise<Params> }) {
  const p = await params
  const page = await getCachedPseoPage(p)
  if (!page) notFound()

  const healthLabel = page.gemHealthScore
    ? page.gemHealthScore >= 75 ? 'Uitstekend'
    : page.gemHealthScore >= 55 ? 'Goed'
    : page.gemHealthScore >= 35 ? 'Matig' : 'Slecht'
    : null

  const netBadge = {
    ROOD: { label: 'Vol stroomnet', color: 'text-red-400 bg-red-900/30' },
    ORANJE: { label: 'Druk stroomnet', color: 'text-amber-400 bg-amber-900/30' },
    GROEN: { label: 'Vrij stroomnet', color: 'text-emerald-400 bg-emerald-900/30' },
  }

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-100">
      {/* JSON-LD */}
      {page.jsonLd && Object.keys(page.jsonLd).length > 0 && (
        <LocalSchema jsonLd={page.jsonLd} />
      )}

      {/* Hero */}
      <section className="px-4 py-16 max-w-4xl mx-auto">
        <div className="flex flex-wrap gap-3 mb-6">
          {page.netcongestieStatus && netBadge[page.netcongestieStatus as keyof typeof netBadge] && (
            <span className={`text-xs font-mono px-3 py-1 rounded-full ${netBadge[page.netcongestieStatus as keyof typeof netBadge].color}`}>
              {netBadge[page.netcongestieStatus as keyof typeof netBadge].label}
            </span>
          )}
          {page.gemBouwjaar && (
            <span className="text-xs font-mono px-3 py-1 rounded-full text-slate-400 bg-slate-800">
              Bouwjaar ~{page.gemBouwjaar}
            </span>
          )}
          {healthLabel && (
            <span className="text-xs font-mono px-3 py-1 rounded-full text-amber-400 bg-amber-900/30">
              Score: {healthLabel}
            </span>
          )}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          {page.titel ?? `Zonnepanelen & batterij op ${p.straat}`}
        </h1>

        {page.metaDescription && (
          <p className="text-slate-400 text-lg mb-8">{page.metaDescription}</p>
        )}

        {/* CTA */}
        <a
          href={`/check?adres=${encodeURIComponent(`${p.straat} ${p.stad}`)}`}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold px-6 py-3 rounded-lg transition-colors"
        >
          Check uw woning gratis →
        </a>
      </section>

      {/* Main content */}
      {page.hoofdtekst && (
        <section className="px-4 pb-12 max-w-4xl mx-auto">
          <div className="prose prose-invert prose-slate max-w-none">
            {page.hoofdtekst.split('\n\n').map((para, i) => (
              <p key={i} className="text-slate-300 mb-4 leading-relaxed">{para}</p>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      {page.faqItems.length > 0 && (
        <section className="px-4 pb-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-amber-400">Veelgestelde vragen</h2>
          <div className="space-y-4">
            {page.faqItems.map((faq, i) => (
              <div key={i} className="border border-slate-700 rounded-lg p-5 bg-slate-800/50">
                <h3 className="font-semibold text-slate-100 mb-2">{faq.vraag}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{faq.antwoord}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
