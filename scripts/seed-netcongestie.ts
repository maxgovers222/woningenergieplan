// scripts/seed-netcongestie.ts
// Run with: npx tsx scripts/seed-netcongestie.ts
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { getSeedStatus, getNetbeheerderNaam } from '../lib/netcongestie'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  console.log('Seeding netcongestie_cache for all Dutch postcode prefixes (1000-9999)...')
  const rows = []
  const now = new Date().toISOString()
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days

  for (let prefix = 1000; prefix <= 9999; prefix++) {
    rows.push({
      postcode_prefix: String(prefix),
      status: getSeedStatus(String(prefix)),
      netbeheerder: getNetbeheerderNaam(String(prefix)),
      capaciteit_details: { bron: 'seed_v1' },
      cached_at: now,
      expires_at: expires,
    })
  }

  // Batch upsert in chunks of 500
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase
      .from('netcongestie_cache')
      .upsert(chunk, { onConflict: 'postcode_prefix' })
    if (error) { console.error('Error at chunk', i, error); process.exit(1) }
    console.log(`Seeded ${Math.min(i + chunkSize, rows.length)} / ${rows.length}`)
  }
  console.log('Done! 9000 postcode prefixes seeded.')
}

seed().catch(console.error)
