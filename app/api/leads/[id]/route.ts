import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const email = searchParams.get('email')?.toLowerCase().trim()

  if (!token || !email) {
    return NextResponse.json({ error: 'token en email verplicht' }, { status: 400 })
  }

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, email, naam')
    .eq('id', id)
    .eq('email', email)
    .maybeSingle()

  if (!lead) {
    return NextResponse.json({ error: 'Lead niet gevonden' }, { status: 404 })
  }

  // Token: base64url van "leadId:email:key_prefix" — eenvoudig maar voldoende voor AVG-flow
  const expected = Buffer.from(
    `${id}:${email}:${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 16) ?? ''}`
  ).toString('base64url').slice(0, 32)

  if (token !== expected) {
    return NextResponse.json({ error: 'Ongeldig token' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('leads').delete().eq('id', id)
  if (error) {
    console.error('[GDPR delete]', error)
    return NextResponse.json({ error: 'Verwijdering mislukt' }, { status: 500 })
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: email,
    subject: 'Uw gegevens zijn verwijderd — SaldeerScan',
    html: `<p style="font-family:sans-serif">Beste ${lead.naam},</p>
<p style="font-family:sans-serif">Uw aanvraag en alle bijbehorende gegevens zijn permanent verwijderd uit ons systeem conform de AVG (Algemene Verordening Gegevensbescherming).</p>
<p style="font-family:sans-serif">Met vriendelijke groet,<br>SaldeerScan.nl<br><a href="mailto:privacy@saldeerscan.nl">privacy@saldeerscan.nl</a></p>`,
  }).catch(err => console.error('[GDPR delete] bevestigingsmail mislukt:', err))

  return NextResponse.json({ deleted: true })
}
