import 'server-only'
import { createHmac } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'

function signPayload(payload: string, apiKeyHash: string): string {
  return createHmac('sha256', apiKeyHash)
    .update(payload)
    .digest('hex')
}

interface B2BPartner {
  id: string
  naam: string
  webhook_url: string
  api_key_hash: string
  lead_filter: {
    min_health_score?: number
    netcongestie_exclude?: string[]
    provincie?: string[]
  }
}

async function getActivePartners(lead: Record<string, unknown>): Promise<B2BPartner[]> {
  const { data: partners, error } = await supabaseAdmin
    .from('b2b_partners')
    .select('id, naam, webhook_url, api_key_hash, lead_filter')
    .eq('actief', true)

  if (error || !partners) return []

  // Apply lead_filter to each partner
  return partners.filter((partner: B2BPartner) => {
    const filter = partner.lead_filter ?? {}

    if (filter.min_health_score && (lead.health_score as number) < filter.min_health_score) return false
    if (filter.netcongestie_exclude?.includes(lead.netcongestie_status as string)) return false
    if (filter.provincie && !(filter.provincie as string[]).includes(lead.provincie as string)) return false
    return true
  })
}

export async function dispatchToPartners(leadId: string): Promise<{ dispatched: number; reason?: string }> {
  // Fetch the full enriched lead
  const { data: lead, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (error || !lead) {
    console.error('[webhooks] lead niet gevonden:', leadId)
    return { dispatched: 0, reason: 'lead_not_found' }
  }

  // GDPR consent gate — never dispatch without consent
  if (!lead.gdpr_consent) {
    console.warn(`[webhooks] Lead ${leadId} heeft geen GDPR consent — webhook geblokkeerd`)
    return { dispatched: 0, reason: 'no_consent' }
  }

  const partners = await getActivePartners(lead as Record<string, unknown>)
  let dispatched = 0

  for (const partner of partners) {
    const payload = JSON.stringify({
      event: 'lead.technisch_dossier',
      lead_id: lead.id,
      timestamp: new Date().toISOString(),
      adres: lead.adres,
      postcode: lead.postcode,
      stad: lead.stad,
      provincie: lead.provincie,
      health_score: lead.health_score,
      netcongestie: lead.netcongestie_status,
      bag: lead.bag_data,
      roi: lead.roi_berekening,
      meterkast: lead.meterkast_analyse,
      plaatsing: lead.plaatsing_analyse,
      omvormer: lead.omvormer_analyse,
      isde: lead.isde_pre_fill,
      contact: {
        naam: lead.naam,
        email: lead.email,
        telefoon: lead.telefoon,
      },
    })

    const signature = signPayload(payload, partner.api_key_hash)

    try {
      const res = await fetch(partner.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WEP-Signature': signature,
          'X-WEP-Version': '1.0',
          'X-WEP-Lead-ID': lead.id,
        },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      })

      if (res.ok) {
        dispatched++
        console.log(`[webhooks] Dispatched to ${partner.naam}`)
      } else {
        console.error(`[webhooks] ${partner.naam} responded ${res.status}`)
      }
    } catch (err) {
      console.error(`[webhooks] Error dispatching to ${partner.naam}:`, err)
    }
  }

  // Mark as exported
  const { error: updateError } = await supabaseAdmin
    .from('leads')
    .update({
      b2b_export_status: dispatched > 0 ? 'exported' : 'failed',
      b2b_exported_at: new Date().toISOString(),
    })
    .eq('id', leadId)
  if (updateError) console.error('[webhooks] export status update failed:', updateError.message)

  return { dispatched }
}
