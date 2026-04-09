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

  return pages.map(p => ({
    url: `https://saldeerscan.nl${p.slug}`,
    lastModified: p.generated_at ? new Date(p.generated_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))
}
