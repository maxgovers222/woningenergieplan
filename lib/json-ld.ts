// Pure schema builder — safe for server and build-time use
export function buildLocalBusinessSchema(params: {
  straat: string
  stad: string
  provincie: string
  postcode?: string
  faqItems?: Array<{ vraag: string; antwoord: string }>
}): Record<string, unknown> {
  const graph: unknown[] = [
    {
      '@type': 'LocalBusiness',
      '@id': `https://saldeerscan.nl/${params.provincie}/${params.stad}`,
      name: `SaldeerScan — ${params.straat}, ${params.stad}`,
      description: `Energieadvies en zonnepanelen planning voor woningen op ${params.straat} in ${params.stad}.`,
      url: 'https://saldeerscan.nl',
      telephone: '+31-800-ENERGIE',
      address: {
        '@type': 'PostalAddress',
        streetAddress: params.straat,
        addressLocality: params.stad,
        addressRegion: params.provincie,
        addressCountry: 'NL',
        ...(params.postcode ? { postalCode: params.postcode } : {}),
      },
      areaServed: {
        '@type': 'AdministrativeArea',
        name: params.stad,
      },
    },
  ]

  if (params.faqItems && params.faqItems.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: params.faqItems.map(faq => ({
        '@type': 'Question',
        name: faq.vraag,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.antwoord,
        },
      })),
    })
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}
