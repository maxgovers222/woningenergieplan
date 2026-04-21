import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/Analytics";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SaldeerScan.nl — Gratis 2027 saldeercheck voor uw woning",
  description: "Ontdek in 3 minuten wat de afschaffing van salderen op 1 januari 2027 voor uw woning betekent. Gratis AI-scan, BAG-data en persoonlijk investeringsrapport.",
  openGraph: {
    title: "SaldeerScan.nl — Gratis 2027 saldeercheck",
    description: "Hoeveel bespaart u vóór 2027? Gratis AI-scan met BAG-data en persoonlijk investeringsrapport.",
    locale: "nl_NL",
    type: "website",
    siteName: "SaldeerScan.nl",
  },
  twitter: {
    card: "summary_large_image",
    title: "SaldeerScan.nl — Gratis 2027 saldeercheck",
    description: "Hoeveel bespaart u vóór 2027? Gratis AI-scan met BAG-data.",
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SaldeerScan.nl',
  url: 'https://saldeerscan.nl',
  logo: 'https://saldeerscan.nl/logo.png',
  description: 'Gratis AI-scan voor de 2027 salderingsafschaffing — ROI berekening en investeringsrapport voor Nederlandse woningeigenaren.',
  areaServed: 'NL',
  serviceType: 'Energie-advies',
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', availableLanguage: 'Dutch' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      className={`${jakarta.variable} ${dmSans.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Analytics />
        {children}
      </body>
    </html>
  );
}
