import 'server-only'
import { createSign } from 'crypto'

interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri: string
}

function base64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now,
  }))

  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(sa.private_key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const jwt = `${header}.${payload}.${signature}`

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await res.json() as { access_token?: string }
  if (!data.access_token) throw new Error('Google OAuth2 token mislukt')
  return data.access_token
}

export async function notifyGoogleIndexing(url: string): Promise<void> {
  const saJson = process.env.GOOGLE_INDEXING_SA_KEY
  if (!saJson) return

  const sa = JSON.parse(saJson) as ServiceAccount
  const token = await getAccessToken(sa)

  await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url, type: 'URL_UPDATED' }),
  })
}
