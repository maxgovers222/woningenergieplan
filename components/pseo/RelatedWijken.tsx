import Link from 'next/link'
import { getTopWijken } from '@/lib/pseo'

function toDisplay(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export async function RelatedWijken({ limit = 4 }: { limit?: number }) {
  let wijken: Awaited<ReturnType<typeof getTopWijken>> = []
  try {
    wijken = await getTopWijken(limit)
  } catch {
    return null
  }

  if (wijken.length === 0) return null

  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <h2 className="font-heading text-xl text-white font-bold mb-2">
        Bekijk wijk-analyses
      </h2>
      <p className="text-slate-400 text-sm mb-6">
        Bekijk hoe deze informatie voor specifieke wijken in Nederland uitpakt.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {wijken.map(({ provincie, stad, wijk }) => (
          <Link
            key={`${provincie}/${stad}/${wijk}`}
            href={`/${provincie}/${stad}/${wijk}`}
            className="group bg-slate-900/40 border border-white/10 rounded-xl p-4 hover:border-amber-500/40 hover:bg-slate-900/60 transition-all"
          >
            <div className="text-white font-semibold text-sm group-hover:text-amber-300 transition-colors leading-tight">
              {toDisplay(wijk)}
            </div>
            <div className="text-slate-500 text-xs mt-1">
              {toDisplay(stad)}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
