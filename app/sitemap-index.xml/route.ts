export const dynamic = 'force-static'

// Indices match the order in generateSitemaps() in app/sitemap.ts:
// 0-11: provincies (noord-holland … limburg), 12: kennisbank, 13: nieuws
const SITEMAP_COUNT = 14

export async function GET() {
  const entries = Array.from({ length: SITEMAP_COUNT }, (_, i) =>
    `  <sitemap><loc>https://saldeerscan.nl/sitemap/${i}.xml</loc></sitemap>`
  ).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
