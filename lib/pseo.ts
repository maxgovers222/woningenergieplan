import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface PseoPageData {
  slug: string
  provincie: string
  stad: string
  wijk: string | null
  straat: string | null
  titel: string | null
  metaDescription: string | null
  hoofdtekst: string | null
  faqItems: Array<{ vraag: string; antwoord: string }>
  jsonLd: Record<string, unknown>
  gemBouwjaar: number | null
  gemHealthScore: number | null
  netcongestieStatus: string | null
  aantalWoningen: number | null
  generatedAt: string | null
}

export async function getPseoPage(params: {
  provincie: string
  stad: string
  wijk: string
  straat: string
}): Promise<PseoPageData | null> {
  const slug = `/${params.provincie}/${params.stad}/${params.wijk}/${params.straat}`

  const { data, error } = await supabaseAdmin
    .from('pseo_pages')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) return null

  return {
    slug: data.slug,
    provincie: data.provincie,
    stad: data.stad,
    wijk: data.wijk,
    straat: data.straat,
    titel: data.titel,
    metaDescription: data.meta_description,
    hoofdtekst: data.hoofdtekst,
    faqItems: data.faq_items ?? [],
    jsonLd: data.json_ld ?? {},
    gemBouwjaar: data.gem_bouwjaar,
    gemHealthScore: data.gem_health_score,
    netcongestieStatus: data.netcongestie_status,
    aantalWoningen: data.aantal_woningen,
    generatedAt: data.generated_at,
  }
}

export async function getTopPseoPages(limit = 500) {
  const { data } = await supabaseAdmin
    .from('pseo_pages')
    .select('provincie, stad, wijk, straat')
    .not('straat', 'is', null)
    .order('aantal_woningen', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getWijkPage(params: {
  provincie: string
  stad: string
  wijk: string
}): Promise<PseoPageData | null> {
  const slug = `/${params.provincie}/${params.stad}/${params.wijk}`

  const { data, error } = await supabaseAdmin
    .from('pseo_pages')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !data) return null

  return {
    slug: data.slug,
    provincie: data.provincie,
    stad: data.stad,
    wijk: data.wijk,
    straat: null,
    titel: data.titel,
    metaDescription: data.meta_description,
    hoofdtekst: data.hoofdtekst,
    faqItems: data.faq_items ?? [],
    jsonLd: data.json_ld ?? {},
    gemBouwjaar: data.gem_bouwjaar,
    gemHealthScore: data.gem_health_score,
    netcongestieStatus: data.netcongestie_status,
    aantalWoningen: data.aantal_woningen,
    generatedAt: data.generated_at,
  }
}

export async function getTopWijken(limit = 500) {
  const { data } = await supabaseAdmin
    .from('pseo_pages')
    .select('provincie, stad, wijk')
    .not('wijk', 'is', null)
    .is('straat', null)
    .order('aantal_woningen', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []).filter(
    (d): d is { provincie: string; stad: string; wijk: string } =>
      !!d.provincie && !!d.stad && !!d.wijk
  )
}

export async function getPseoPagesByProvincie(provincie: string) {
  const { data } = await supabaseAdmin
    .from('pseo_pages')
    .select('slug, generated_at')
    .eq('provincie', provincie)
    .eq('status', 'published')
    .is('straat', null)
  return data ?? []
}

export async function getWijkenByStad(provincie: string, stad: string) {
  const { data } = await supabaseAdmin
    .from('pseo_pages')
    .select('wijk, gem_bouwjaar, gem_health_score, netcongestie_status, aantal_woningen')
    .eq('provincie', provincie)
    .eq('stad', stad)
    .is('straat', null)
    .not('wijk', 'is', null)
    .eq('status', 'published')
    .order('aantal_woningen', { ascending: false, nullsFirst: false })
  const WIJK_SLUG_REGEX = /^[a-z][a-z-]*[a-z]$/
  return (data ?? []).filter(row => row.wijk && WIJK_SLUG_REGEX.test(row.wijk)) as {
    wijk: string
    gem_bouwjaar: number | null
    gem_health_score: number | null
    netcongestie_status: string | null
    aantal_woningen: number | null
  }[]
}

export async function getStaddenByProvincie(provincie: string) {
  const { data } = await supabaseAdmin
    .from('pseo_pages')
    .select('stad, aantal_woningen')
    .eq('provincie', provincie)
    .is('straat', null)
    .not('wijk', 'is', null)
    .eq('status', 'published')
  if (!data) return []

  // Deduplicate stads, sum woningen per stad
  const map = new Map<string, number>()
  for (const row of data) {
    if (!row.stad) continue
    map.set(row.stad, (map.get(row.stad) ?? 0) + (row.aantal_woningen ?? 0))
  }
  return Array.from(map.entries())
    .map(([stad, totalWoningen]) => ({ stad, totalWoningen }))
    .sort((a, b) => b.totalWoningen - a.totalWoningen)
}

export async function getTopStadden(limit = 100) {
  const { data } = await supabaseAdmin
    .from('pseo_pages')
    .select('provincie, stad, aantal_woningen')
    .is('straat', null)
    .not('wijk', 'is', null)
    .eq('status', 'published')
  if (!data) return []

  const map = new Map<string, { provincie: string; totalWoningen: number }>()
  for (const row of data) {
    if (!row.stad || !row.provincie) continue
    const key = `${row.provincie}/${row.stad}`
    const prev = map.get(key)
    map.set(key, {
      provincie: row.provincie,
      totalWoningen: (prev?.totalWoningen ?? 0) + (row.aantal_woningen ?? 0),
    })
  }
  return Array.from(map.entries())
    .map(([key, val]) => ({ stad: key.split('/')[1], provincie: val.provincie, totalWoningen: val.totalWoningen }))
    .sort((a, b) => b.totalWoningen - a.totalWoningen)
    .slice(0, limit)
}
