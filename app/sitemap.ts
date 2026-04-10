import { MetadataRoute } from 'next'
import { getPseoPagesByProvincie } from '@/lib/pseo'

const PROVINCIES = [
  'noord-holland', 'zuid-holland', 'utrecht', 'noord-brabant',
  'gelderland', 'overijssel', 'friesland', 'groningen',
  'drenthe', 'flevoland', 'zeeland', 'limburg',
]

const PROVINCIE_SLUG_TO_NAAM: Record<string, string> = {
  'noord-holland': 'Noord-Holland',
  'zuid-holland': 'Zuid-Holland',
  'utrecht': 'Utrecht',
  'noord-brabant': 'Noord-Brabant',
  'gelderland': 'Gelderland',
  'overijssel': 'Overijssel',
  'friesland': 'Friesland',
  'groningen': 'Groningen',
  'drenthe': 'Drenthe',
  'flevoland': 'Flevoland',
  'zeeland': 'Zeeland',
  'limburg': 'Limburg',
}

export async function generateSitemaps() {
  return PROVINCIES.map(id => ({ id }))
}

export default async function sitemap({ id }: { id: string | Promise<string> }): Promise<MetadataRoute.Sitemap> {
  // id = provincie slug (e.g. 'noord-holland')
  // In Next.js 16, id may be passed as a Promise
  const resolvedId = await Promise.resolve(id)
  // Convert slug back to provincie name for DB query
  const provincieNaam = PROVINCIE_SLUG_TO_NAAM[resolvedId] ?? resolvedId

  let pages: Awaited<ReturnType<typeof getPseoPagesByProvincie>> = []
  try {
    pages = await getPseoPagesByProvincie(provincieNaam)
  } catch {
    // DB not available at build time — return empty sitemap for this provincie
    return []
  }

  const now = new Date()

  // Provincie-overzichtspagina
  const provincieUrl = [{
    url: `https://saldeerscan.nl/${resolvedId}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.9,
  }]

  // Stad-overzichtspagina's (unieke stads uit de wijk-slugs)
  const stadSlugs = new Set(
    pages
      .map(p => p.slug.split('/').slice(0, 3).join('/'))
      .filter(s => s.split('/').length === 3)
  )
  const stadUrls = Array.from(stadSlugs).map(s => ({
    url: `https://saldeerscan.nl${s}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.85,
  }))

  // Wijk-pagina's
  const wijkUrls = pages.map(p => ({
    url: `https://saldeerscan.nl${p.slug}`,
    lastModified: p.generated_at ? new Date(p.generated_at) : now,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  return [...provincieUrl, ...stadUrls, ...wijkUrls]
}
