import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type NetcongestieStatus = 'ROOD' | 'ORANJE' | 'GROEN'

export interface NetcongestieResult {
  status: NetcongestieStatus
  netbeheerder: string
  uitleg: string
  terugleveringBeperkt: boolean
  postcodePrefix: string
}

// Map of postcode prefix ranges to netbeheerder
// Source: https://www.netbeheernederland.nl/
export const NETBEHEERDER_MAP: Array<{ van: number; tot: number; naam: string }> = [
  { van: 1000, tot: 1999, naam: 'Liander' },   // Noord-Holland
  { van: 2000, tot: 2999, naam: 'Stedin' },    // Zuid-Holland/Zeeland
  { van: 3000, tot: 3999, naam: 'Stedin' },    // Utrecht/Zuid-Holland
  { van: 4000, tot: 4999, naam: 'Enexis' },    // Noord-Brabant/Zeeland
  { van: 5000, tot: 5999, naam: 'Enexis' },    // Noord-Brabant
  { van: 6000, tot: 6999, naam: 'Enexis' },    // Limburg/Gelderland
  { van: 7000, tot: 7999, naam: 'Enexis' },    // Overijssel/Gelderland
  { van: 8000, tot: 8999, naam: 'Enexis' },    // Friesland/Overijssel
  { van: 9000, tot: 9999, naam: 'Enexis' },    // Groningen/Drenthe
]

export function getNetbeheerderNaam(postcodePrefix: string): string {
  const num = parseInt(postcodePrefix)
  return NETBEHEERDER_MAP.find(r => num >= r.van && num <= r.tot)?.naam ?? 'Onbekend'
}

function getUitleg(status: NetcongestieStatus, netbeheerder: string): string {
  switch (status) {
    case 'ROOD':
      return `Het stroomnet van ${netbeheerder} in uw regio is vol. Teruglevering van zonne-energie is beperkt. Een thuisbatterij is extra waardevol.`
    case 'ORANJE':
      return `Het stroomnet van ${netbeheerder} staat onder druk. Piekproductie (middag) wordt soms beperkt. Een batterij maximaliseert uw opbrengst.`
    case 'GROEN':
      return `Het stroomnet van ${netbeheerder} heeft voldoende capaciteit in uw regio. Teruglevering is onbeperkt mogelijk.`
  }
}

// Seed data: realistic congestion status per postcode prefix range (Q1 2026)
// Based on public Netbeheer Nederland capacity maps
export const CONGESTION_SEED: Array<{ van: number; tot: number; status: NetcongestieStatus }> = [
  // Randstad areas: high congestion
  { van: 1000, tot: 1109, status: 'ROOD' },    // Amsterdam centrum
  { van: 1110, tot: 1299, status: 'ORANJE' },  // Amsterdam suburbs
  { van: 2490, tot: 2599, status: 'ROOD' },    // Den Haag centrum
  { van: 3010, tot: 3099, status: 'ROOD' },    // Rotterdam centrum
  { van: 3500, tot: 3599, status: 'ORANJE' },  // Utrecht
  // Agricultural areas: high solar, high congestion
  { van: 8200, tot: 8299, status: 'ROOD' },    // Flevoland
  { van: 8700, tot: 8799, status: 'ROOD' },    // Friesland/Sneek
  { van: 4600, tot: 4799, status: 'ROOD' },    // West-Brabant
  // Default: most areas are orange or green
]

export function getSeedStatus(postcodePrefix: string): NetcongestieStatus {
  const num = parseInt(postcodePrefix)
  const match = CONGESTION_SEED.find(r => num >= r.van && num <= r.tot)
  if (match) return match.status
  // Default heuristic: built-up areas ORANJE, rural GROEN
  if ((num >= 1000 && num <= 1999) || (num >= 2000 && num <= 3999)) return 'ORANJE'
  return 'GROEN'
}

export async function getNetcongestie(postcode: string): Promise<NetcongestieResult> {
  const postcodePrefix = postcode.replace(/\s/g, '').substring(0, 4)

  // 1. Check cache (valid entries only)
  const { data: cached, error: cacheError } = await supabaseAdmin
    .from('netcongestie_cache')
    .select('status, netbeheerder, capaciteit_details')
    .eq('postcode_prefix', postcodePrefix)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (cacheError) console.error('[netcongestie] cache lookup failed:', cacheError.message)

  if (cached) {
    const status = cached.status as NetcongestieStatus
    const netbeheerder = cached.netbeheerder ?? getNetbeheerderNaam(postcodePrefix)
    return {
      status,
      netbeheerder,
      uitleg: getUitleg(status, netbeheerder),
      terugleveringBeperkt: status === 'ROOD',
      postcodePrefix,
    }
  }

  // 2. Cache miss: use seed data (in production, replace with live Netbeheer NL API)
  const status = getSeedStatus(postcodePrefix)
  const netbeheerder = getNetbeheerderNaam(postcodePrefix)

  // 3. Write to cache (upsert, expires in 24h)
  const { error: upsertError } = await supabaseAdmin
    .from('netcongestie_cache')
    .upsert({
      postcode_prefix: postcodePrefix,
      status,
      netbeheerder,
      capaciteit_details: { bron: 'seed_v1', generated_at: new Date().toISOString() },
      cached_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'postcode_prefix' })

  if (upsertError) console.error('[netcongestie] cache upsert failed:', upsertError.message)

  return {
    status,
    netbeheerder,
    uitleg: getUitleg(status, netbeheerder),
    terugleveringBeperkt: status === 'ROOD',
    postcodePrefix,
  }
}
