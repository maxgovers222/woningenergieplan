import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {}

export default withSentryConfig(nextConfig, {
  org: 'saldeerscan',
  project: 'saldeerscan-nextjs',
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  // Sentry draait alleen als NEXT_PUBLIC_SENTRY_DSN is ingesteld
  // Zonder DSN initialiseert Sentry stil zonder fouten te gooien
})
