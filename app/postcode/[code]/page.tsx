import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getWijkenByPostcode } from '@/lib/pseo'

interface Props { params: Promise<{ code: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const clean = code.toUpperCase().replace(/\s/g, '').slice(0, 4)
  return {
    title: `Zonnepanelen ${clean} — Saldeerscan`,
    description: `Bekijk de zonnepanelen-potentie en netcongestiestatus voor postcode ${clean} en omgeving.`,
    alternates: { canonical: `https://saldeerscan.nl/postcode/${clean}` },
    openGraph: {
      title: `Zonnepanelen postcode ${clean}`,
      description: `Netcongestiestatus en opbrengst voor postcode ${clean}.`,
      url: `https://saldeerscan.nl/postcode/${clean}`,
      siteName: 'SaldeerScan.nl',
      locale: 'nl_NL',
      type: 'website',
    },
  }
}

export const revalidate = 2592000 // 30 dagen ISR

export default async function PostcodePage({ params }: Props) {
  const { code } = await params
  const clean = code.toUpperCase().replace(/\s/g, '')
  const prefix = clean.slice(0, 4)
  if (!/^\d{4}$/.test(prefix)) notFound()

  const wijken = await getWijkenByPostcode(prefix)

  return (
    <main className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #020617, #0f172a)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: `Zonnepanelen postcode ${clean}`,
            description: `Netcongestiestatus en zonnepanelen-potentie voor postcode ${clean} en omgeving.`,
            url: `https://saldeerscan.nl/postcode/${clean}`,
            inLanguage: 'nl-NL',
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://saldeerscan.nl' },
              { '@type': 'ListItem', position: 2, name: `Postcode ${clean}`, item: `https://saldeerscan.nl/postcode/${clean}` },
            ],
          }),
        }}
      />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-xs font-sans text-slate-500 mb-6">
          <Link href="/" className="hover:text-slate-300 transition-colors">Home</Link>
          {' › '}
          <span className="text-slate-400">Postcode {clean}</span>
        </nav>

        <h1 className="font-heading text-3xl font-bold text-white mb-2">
          Zonnepanelen postcode {clean}
        </h1>
        <p className="text-slate-400 font-sans mb-8 leading-relaxed">
          Netcongestiestatus en zonnepanelen-potentie voor postcode {clean} en omgeving.
          Kies uw wijk voor een gedetailleerd overzicht.
        </p>

        {wijken.length === 0 ? (
          <div className="bg-slate-900/40 border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-slate-400 font-sans mb-6">
              Nog geen data beschikbaar voor postcode {clean}.
            </p>
            <Link href="/check"
              className="inline-block bg-amber-500 text-slate-950 px-6 py-3 rounded-xl font-sans font-medium shadow-[0_0_25px_rgba(245,158,11,0.4)]">
              Bereken uw persoonlijke potentie →
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-8">
              {wijken.map(w => (
                <Link
                  key={`${w.provincie}/${w.stad}/${w.wijk}`}
                  href={`/${w.provincie}/${w.stad}/${w.wijk}`}
                  className="flex items-center justify-between bg-slate-900/40 border border-white/10 rounded-xl px-5 py-4 hover:border-amber-500/30 transition-colors group"
                >
                  <div>
                    <p className="font-sans font-medium text-white capitalize group-hover:text-amber-300 transition-colors">
                      {w.wijk.replace(/-/g, ' ')}
                    </p>
                    <p className="text-sm font-sans text-slate-500 capitalize">{w.stad.replace(/-/g, ' ')}</p>
                  </div>
                  {w.netcongestie_status && (
                    <span className={[
                      'text-xs font-sans px-2 py-1 rounded-md',
                      w.netcongestie_status === 'ROOD' ? 'bg-red-950/50 text-red-400' :
                      w.netcongestie_status === 'ORANJE' ? 'bg-amber-950/50 text-amber-400' :
                      'bg-emerald-950/50 text-emerald-400'
                    ].join(' ')}>
                      {w.netcongestie_status}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            <div className="text-center">
              <Link href="/check"
                className="bg-amber-500 text-slate-950 px-8 py-3 rounded-xl font-sans font-medium shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:opacity-90 transition-opacity">
                Bereken uw persoonlijke potentie →
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
