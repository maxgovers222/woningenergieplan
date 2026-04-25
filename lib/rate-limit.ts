// lib/rate-limit.ts — Upstash Redis sliding window met in-memory fallback voor lokale dev

let ratelimiter: unknown = null

async function getUpstashLimiter() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null
  if (ratelimiter) return ratelimiter as { limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number }> }

  const { Ratelimit } = await import('@upstash/ratelimit')
  const { Redis } = await import('@upstash/redis')

  ratelimiter = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    }),
    limiter: Ratelimit.slidingWindow(5, '1 h'),
  })

  return ratelimiter as { limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number }> }
}

// In-memory fallback voor lokale dev (geen persistentie)
const memStore = new Map<string, { count: number; resetAt: number }>()

function memRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  if (memStore.size > 1000) {
    for (const [k, v] of memStore) { if (now > v.resetAt) memStore.delete(k) }
  }
  const entry = memStore.get(key)
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, reset: now + windowMs }
  }
  if (entry.count >= limit) {
    return { success: false, remaining: 0, reset: entry.resetAt }
  }
  entry.count++
  return { success: true, remaining: limit - entry.count, reset: entry.resetAt }
}

export async function applyRateLimit(
  request: Request,
  limit = 5,
  windowMs = 3_600_000,
  namespace = new URL(request.url).pathname,
): Promise<{ response: Response; rl: null } | { response: null; rl: { remaining: number; resetAt: number } }> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const key = `${namespace}:${ip}`

  let result: { success: boolean; remaining: number; reset: number }

  const limiter = await getUpstashLimiter()
  if (limiter) {
    result = await limiter.limit(key)
  } else {
    result = memRateLimit(key, limit, windowMs)
  }

  if (!result.success) {
    return {
      response: Response.json(
        { error: 'Te veel verzoeken. Probeer over een uur opnieuw.' },
        { status: 429, headers: { 'Retry-After': '3600', 'X-RateLimit-Remaining': '0' } }
      ),
      rl: null,
    }
  }

  return { response: null, rl: { remaining: result.remaining, resetAt: result.reset } }
}
