import { cache } from 'react'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPseoPage, getTopPseoPages, getStratenByWijk } from '@/lib/pseo'
import { LocalSchema } from '@/components/pseo/LocalSchema'

// Deduplicate Supabase fetches: generateMetadata + page component share one request
const getCachedPseoPage = cache(getPseoPage)

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDisplay(slug: string) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

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
      images: [{
        url: `https://saldeerscan.nl/api/og?titel=${encodeURIComponent(page.titel ?? `Energiebesparing ${p.straat}`)}&score=${page.gemHealthScore ?? ''}&status=${page.netcongestieStatus ?? ''}&type=straat`,
        width: 1200,
        height: 630,
      }],
    },
  }
}

export default async function PseoStreetPage({ params }: { params: Promise<Params> }) {
  const p = await params
  const page = await getCachedPseoPage(p)
  if (!page) notFound()

  const andereStraten = await getStratenByWijk(p.provincie, p.stad, p.wijk, p.straat, 6)

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

      {/* BreadcrumbList JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://saldeerscan.nl/" },
              { "@type": "ListItem", "position": 2, "name": toDisplay(p.provincie), "item": `https://saldeerscan.nl/${p.provincie}` },
              { "@type": "ListItem", "position": 3, "name": toDisplay(p.stad), "item": `https://saldeerscan.nl/${p.provincie}/${p.stad}` },
              { "@type": "ListItem", "position": 4, "name": toDisplay(p.wijk), "item": `https://saldeerscan.nl/${p.provincie}/${p.stad}/${p.wijk}` },
              { "@type": "ListItem", "position": 5, "name": toDisplay(p.straat), "item": `https://saldeerscan.nl/${p.provincie}/${p.stad}/${p.wijk}/${p.straat}` },
            ]
          })
        }}
      />

      {/* Hero */}
      <section className="px-4 py-16 max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6 flex-wrap">
          <a href="/" className="hover:text-amber-400 transition-colors">Home</a>
          <span>/</span>
          <a href={`/${p.provincie}`} className="hover:text-amber-400 transition-colors capitalize">{p.provincie.replace(/-/g, ' ')}</a>
          <span>/</span>
          <a href={`/${p.provincie}/${p.stad}`} className="hover:text-amber-400 transition-colors capitalize">{p.stad.replace(/-/g, ' ')}</a>
          <span>/</span>
          <a href={`/${p.provincie}/${p.stad}/${p.wijk}`} className="hover:text-amber-400 transition-colors capitalize">{p.wijk.replace(/-/g, ' ')}</a>
          <span>/</span>
          <span className="text-slate-400 capitalize">{p.straat.replace(/-/g, ' ')}</span>
        </nav>

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
          {page.aantalWoningen && (
            <span className="text-xs font-mono px-3 py-1 rounded-full text-slate-400 bg-slate-800">
              {page.aantalWoningen} woningen
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
      {/* Andere straten in wijk */}
      {andereStraten.length > 0 && (
        <section className="px-4 pb-16 max-w-4xl mx-auto">
          <div className="border-t border-slate-800 pt-10">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-4">
              Andere straten in {p.wijk.replace(/-/g, ' ')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {andereStraten.map((s) => (
                <a
                  key={s.straat}
                  href={`/${s.provincie}/${s.stad}/${s.wijk}/${s.straat}`}
                  className="bg-slate-900/40 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all hover:bg-slate-900/60 group"
                >
                  <p className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors capitalize" style={{ fontFamily: 'var(--font-heading)' }}>
                    {s.straat.replace(/-/g, ' ')}
                  </p>
                  <p className="text-xs font-mono mt-1 text-slate-500">
                    {s.wijk.replace(/-/g, ' ')}
                  </p>
                </a>
              ))}
            </div>
            <a
              href={`/${p.provincie}/${p.stad}/${p.wijk}`}
              className="inline-flex items-center gap-2 mt-4 text-sm text-slate-400 hover:text-amber-300 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Bekijk alle straten in {p.wijk.replace(/-/g, ' ')}
            </a>
          </div>
        </section>
      )}
    </main>
  )
}
