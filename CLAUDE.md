@AGENTS.md

## Werkwijze voor Claude Code

Gebruik altijd de relevante superpowers skills vóór elke taak:
- **Nieuwe feature of creatief werk** → `superpowers:brainstorming` eerst
- **Bug of onverwacht gedrag** → `superpowers:systematic-debugging`
- **Implementatieplan uitvoeren** → `superpowers:executing-plans`
- **Meerdere onafhankelijke taken** → `superpowers:dispatching-parallel-agents`
- **Werk afronden / branch mergen** → `superpowers:finishing-a-development-branch`
- **Code review ontvangen** → `superpowers:receiving-code-review`
- **Code review aanvragen** → `superpowers:requesting-code-review`
- **Werk valideren voor afronden** → `superpowers:verification-before-completion`

Bij twijfel: gebruik de skill. Niet gebruiken is nooit de veilige keuze.

# Saldeerscan.nl — pSEO Lead Fabriek

Next.js 16 / React 19 platform voor de Nederlandse energiemarkt. Genereert 10.000+ statische pagina's (pSEO op straat- én wijk-niveau) die converteren via een 6-staps funnel naar 'Technisch Dossiers' voor B2B partners (installateurs). Kernurgentie: einde salderen per 1 januari 2027.

## Stack

| Laag | Keuze |
|------|-------|
| Framework | Next.js 16.2.2 + React 19 (App Router) |
| Styling | Tailwind v4 (CSS-first config, geen tailwind.config.ts) |
| UI | Shadcn/UI v4 + `@base-ui/react` |
| Database | Supabase (Postgres) |
| Supabase client | `@supabase/ssr` — drie clients: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/admin.ts` |
| Geocoding | Mapbox Search JS React (`@mapbox/search-js-react`) |
| Grafieken | Recharts v3 |
| AI — screening | Gemini 2.5 Flash (`@google/generative-ai`) |
| AI — diepanalyse | Claude claude-sonnet-4-6 (`@anthropic-ai/sdk`) |
| Email | Resend (transactioneel, fire-and-forget) |
| E2E testen | Playwright (chromium, `tests/e2e/`) |
| Scripts | `tsx` — draai met `npx tsx scripts/<naam>.ts` |

## Projectstructuur

```
app/
  page.tsx                          # Homepage: deep navy hero + CountdownTimer + adreszoek + USPs + stats
  layout.tsx                        # Fonts: Bricolage Grotesque (headings) + DM Sans (body)
  globals.css                       # Tailwind v4 + design tokens + .glass-card-navy + @media print
  sitemap.ts                        # Gesplitste sitemaps per provincie (+ provincie/stad URLs)
  privacy/page.tsx                  # AVG-compliant privacyverklaring (9 secties, volledig ingevuld)
  icon.tsx                          # Dynamische favicon 32x32 (edge runtime, navy cirkel + amber hexagon)
  apple-icon.tsx                    # Apple touch icon 180x180 (zelfde stijl)
  check/page.tsx                    # 6-staps Super Funnel (Suspense + useSearchParams voor ?adres=, ?wijk=, ?stad= prefill)
  [provincie]/page.tsx              # Provincie overzichtspagina met steden (ISR 30d)
  [provincie]/[stad]/page.tsx       # Stad overzichtspagina met wijken + urgentie strip (ISR 30d)
  [provincie]/[stad]/[wijk]/page.tsx          # pSEO wijk-pagina (ISR 30d) + breadcrumb + ranking badge + CountdownTimer
  [provincie]/[stad]/[wijk]/[straat]/page.tsx # pSEO adrespagina (ISR 30d)
  api/
    bag/route.ts                    # BAG/PDOK lookup
    bag/suggest/route.ts            # Adres autocomplete suggesties
    netcongestie/route.ts           # Netbeheer NL congestion check
    roi/route.ts                    # ROI + 2027 shock-effect
    health-score/route.ts           # Energie score 0-100
    vision/route.ts                 # Two-tier Vision analyse
    generate-content/route.ts       # Gemini Flash pSEO content
    leads/route.ts                  # Lead opslaan + webhook trigger + Resend bevestigingsmail
    webhooks/b2b/route.ts           # B2B partner webhook dispatcher

components/
  CountdownTimer.tsx                # Client countdown naar 2027-01-01, SSR-safe (-- placeholder), 4 glass cards
  funnel/
    FunnelContainer.tsx             # useReducer state machine (6 stappen), accepteert initialAdres/initialWijk/initialStad props + localStorage persistentie
    Step1Adres.tsx                  # Auto-zoekt bij mount als initialAdres aanwezig; AnalysisLoading tijdens fetch
    Step2ROI.tsx … Step6LeadCapture.tsx
    ResultsDashboard.tsx            # Volledig resultaten dashboard na lead submit: ShockChart + ROITijdlijn + GevalideerdStempel + PDF/print (geen nep-expert sectie)
    Shock2027Banner.tsx             # 2027 saldering urgentie — amber design (bg-amber-950/20 border-amber-500/25), geen rode kleuren
    PhotoUpload.tsx                 # Dropzone + vision API (geen icon prop, vaste SVG upload icon)
    FunnelProgress.tsx
    AnalysisLoading.tsx             # Labor illusion loader met roterende berichten (BAG / netcapaciteit / ROI)
    StepHeader.tsx                  # Gedeelde stap-header component — clean design: geen grid/glow, stap-label 'Stap X — Naam' in DM Sans
    PDFDownloadButton.tsx           # @react-pdf/renderer v4, dynamic import (ssr:false), window.print() fallback
    types.ts                        # Gedeelde funnel types (incl. wijk + stad in FunnelState)
  pseo/
    LocalSchema.tsx                 # JSON-LD LocalBusiness + FAQPage injectie (prop: jsonLd)
  ui/                               # Shadcn componenten

lib/
  bag.ts                            # BAG adapter (Mapbox → PDOK)
  netcongestie.ts                   # Postcode-prefix cache lookup
  roi.ts                            # ROI algoritme + saldering afbouw 2026→2027
  health-score.ts                   # Score 0-100 (bouwjaar/label/dak/congestie)
  gemini.ts                         # Gemini 2.5 Flash adapter (pSEO content + screening + generateWijkContent met 800w + 5 FAQs)
  vision.ts                         # Two-tier: Gemini screen → Claude diepanalyse + withRetry
  webhooks.ts                       # HMAC-SHA256 signed B2B dispatcher (consent-gated)
  rate-limit.ts                     # In-memory sliding window, namespace per route
  pseo.ts                           # pSEO page helpers: getWijkPage, getTopWijken, getWijkenByStad, getStaddenByProvincie, getTopStadden
  json-ld.ts                        # JSON-LD builder
  supabase/server.ts|browser.ts|admin.ts

scripts/
  seed-netcongestie.ts              # Seed netcongestie_cache tabel
  seed-pseo.ts                      # Seed eerste batch pSEO adrespagina's
  seed-wijken.ts                    # 2000-wijk seed via Gemini AI (--skip-existing, --batch=0,50, --dry-run flags; CBS PDOK WFS voor aantalWoningen; JSON-LD @graph)

tests/
  e2e/
    wijk-validatie.spec.ts          # Test 2 bekende golden batch wijk URLs (200 status + H1 + JSON-LD)
    funnel-handshake.spec.ts        # Test URL params + countdown timer aanwezig
    funnel-validatie.spec.ts        # Test disabled button, progress bar, homepage CTA

supabase/migrations/
  20260407000001_leads.sql
  20260407000002_pseo_pages.sql
  20260407000003_netcongestie_cache.sql   # Bevat ook b2b_partners tabel + FK naar leads
  20260410000001_pseo_status.sql          # Voegt status kolom toe aan pseo_pages (draft/published)
```

## Database tabellen

- **leads** — volledig verrijkt lead record; GDPR-constraint blokkeert B2B export zonder consent
- **pseo_pages** — gegenereerde pagina's (slug, SEO content, JSON-LD, stats); kolom `status` (draft/published)
- **netcongestie_cache** — postcode-prefix → ROOD/ORANJE/GROEN (TTL 24h)
- **b2b_partners** — webhook URL, HMAC key hash, lead filter (min score, provincie, etc.)

## Kritieke architectuurbeslissingen

### Vision: two-tier kostenbeheer
`lib/vision.ts` werkt in twee lagen:
1. **Tier 1 — Gemini 2.5 Flash** (screening, ~€0.0001/call): beantwoordt "Is dit een [type]? Ja/Nee + confidence". Drempel: confidence < 0.7 → foutmelding naar gebruiker.
2. **Tier 2 — Claude claude-sonnet-4-6** (diepanalyse, alleen als Tier 1 ≥ 0.7): geeft gestructureerde JSON terug per type (meterkast/plaatsing/omvormer).

`withRetry` wrapper in `vision.ts` handelt Claude 529 (overloaded) en 429 (rate limit) af met exponential backoff (1s, 2s, 3s).

### GDPR consent gate
De B2B webhook dispatcher in `lib/webhooks.ts` controleert altijd `gdpr_consent === true` vóór dispatch. Zonder consent: nul webhooks, log warning. De database heeft een CHECK constraint `b2b_requires_consent` als extra zekerheid.

### Saldering afbouw 2027
`lib/roi.ts` heeft een `SALDERING_SCHEMA` map (2025: 64%, 2026: 28%, 2027: 0%). Het `shockEffect2027` object drijft urgentie in `Shock2027Banner.tsx` én op pSEO-pagina's.

### Rate limiting
`lib/rate-limit.ts` — in-memory sliding window, 5 req/IP/uur, **namespace per route** (key = `${pathname}:${ip}`). Voorkomt dat BAG + ROI + netcongestie calls dezelfde teller delen. `pruneExpiredEntries()` verwijdert verlopen entries als de Map > 1000 entries bereikt. Voor productie vervangen door Upstash Redis.

### URL pre-fill handshake
`app/check/page.tsx` leest `useSearchParams()` (wrapped in `Suspense`):
- `?adres=` → `initialAdres` → `FunnelContainer` → `Step1Adres` triggert `doSearch()` automatisch bij mount
- `?wijk=` + `?stad=` → `initialWijk` / `initialStad` → in `FunnelState` → gebruikt door `AnalysisLoading` voor dynamische berichten

wijk-pSEO CTA linkt naar `/check?wijk=[wijk]&stad=[stad]` om de URL handshake te activeren.

### Funnel localStorage persistentie
`FunnelContainer` slaat volledige `FunnelState` op in `localStorage` (key: `funnel_state`). Bij herladen verschijnt een "Doorgaan waar je was?" banner — ook als URL-params aanwezig zijn (initialAdres/Wijk/Stad). Opslaan is gedebounced met 500ms om I/O te beperken.

### pSEO routes — drie niveaus
- **Provincie-niveau**: `app/[provincie]/page.tsx` — ISR 7d, steden overzicht, JSON-LD AdministrativeArea
- **Stad-niveau**: `app/[provincie]/[stad]/page.tsx` — ISR 7d, wijken overzicht, urgentie strip, JSON-LD City
- **Wijk-niveau**: `app/[provincie]/[stad]/[wijk]/page.tsx` — ISR 7d, `generateStaticParams()` via `getTopWijken(500)`, AI-content via `generateWijkContent()`, breadcrumb, ranking badge, CountdownTimer, BreadcrumbList JSON-LD, gerelateerde wijken sectie onderaan
- **Straat-niveau**: `app/[provincie]/[stad]/[wijk]/[straat]/page.tsx` — ISR 30d, `generateStaticParams()` pre-bouwt top-500 straten op `aantal_woningen`

### Wijk ranking badge
`neighborhoodRanking(bouwjaar, score)` in wijk pagina:
- score ≥ 90 of (bouwjaar 1995-2015 → rendementScore=92) → "Top 10% meest rendabele wijken"
- score ≥ 74 → "Top 25% meest rendabele wijken"
- anders: geen badge

### CountdownTimer component
`components/CountdownTimer.tsx` — `'use client'`, telt af naar `2027-01-01T00:00:00+01:00`. SSR-safe: rendert `--` placeholder, hydrates bij client mount. Geplaatst op: homepage (hero), `/check`, wijk pagina's. 4 glass cards: Dagen/Uren/Min/Sec.

### ResultsDashboard — success state
`components/funnel/ResultsDashboard.tsx` — volledig resultaten scherm na lead submit in Step 6:
- `useCountUp(target, duration)` hook met ease-out cubic via requestAnimationFrame
- `ShockChart` — horizontale animatiebalk 2024→2027 saldering crash
- `ROITijdlijn` — 4 mijlpalen tijdlijn (installatie / halverwege / terugverdiend / 15jr)
- `GevalideerdStempel` — geanimeerd groen "✓ Gevalideerd 2027" stamp
- `ExpertSectie` — expert avatar + amber CTA naar expert consult
- PDF download knop + `window.print()` met `.no-print` class op knoppen

### Sitemaps
`app/sitemap.ts` gebruikt `generateSitemaps()` om per provincie een apart XML-bestand te genereren (max 50k URL's per sitemap). Bevat nu ook provincie-URLs (priority 0.9) en stad-URLs (priority 0.85).

### ROI validatie
`app/api/roi/route.ts` — bouwjaar validatie: `< 1000 || > 2030` (niet < 1800, want panden zoals Anne Frank Huis zijn 1635). DakOppervlakte max: 5000 m² (niet 500).

### pSEO content kwaliteit
`scripts/seed-wijken.ts` — géén template fallback, altijd Gemini. Haalt CBS PDOK WFS data op voor echte `aantalWoningen`. Gemini prompt: 800w hyperlocale content + 5 FAQs. JSON-LD @graph: WebPage + FAQPage. Flags: `--skip-existing`, `--batch=START,END`, `--dry-run`.

### Email bevestiging
`app/api/leads/route.ts` — na succesvolle lead opslag stuurt Resend een bevestigingsmail. Email call is **geawait** (niet fire-and-forget) zodat de Promise niet wegvalt in serverless. FROM-adres: `RESEND_FROM_EMAIL` env var — **geen fallback meer**. Stel in Vercel in als `SaldeerScan <noreply@saldeerscan.nl>` (display name zonder punt vermijdt RFC 5322 422-errors). Email template: donker amber urgency bar (`#1c1208` + `#fbbf24`), geen download knop, dynamisch copyright jaar.

### Lead validatie (Step 6)
`components/funnel/Step6LeadCapture.tsx` — strikte validatie vóór submit:
- **Naam**: minimaal 2 woorden vereist (voor- + achternaam)
- **Email**: trim + lowercase normalisatie, regex min TLD-lengte 2
- **Telefoon**: landselector (NL +31 / BE +32 / DE +49 / LU +352) + regex per land. Opgeslagen in internationaal formaat (`+31612345678`). Live groen vinkje toont genormaliseerd nummer zodra het valide is.
- `normalizePhone(raw, code)` strip leading zero + prepend country code
- `validatePhone(raw, code)` regex per land via `COUNTRIES` array

### Interne linking structuur
Breadcrumbs: Home → Provincie → Stad → Wijk op alle pSEO pagina's. Provincie pagina's linken naar alle steden. Stad pagina's linken naar alle wijken. Wijk CTAs linken naar `/check?wijk=...&stad=...`. Sitemap bevat alle drie niveaus. Wijkpagina's bevatten ook een "Andere wijken in {stad}" sectie (max 6 links, via `getWijkenByStad()`) voor extra interne linking.

BreadcrumbList JSON-LD aanwezig op provincie (Home→Provincie), stad (Home→Provincie→Stad) en wijk pagina's (Home→Provincie→Stad→Wijk). Canonical URLs zijn absoluut (`https://saldeerscan.nl/...`) op alle pSEO routes. Organization JSON-LD schema staat in root layout. `app/robots.ts` genereert `/robots.txt` via Next.js MetadataRoute.

## Design systeem

**Identiteit: High-End Engineering Dashboard — deep navy + amber**

Homepage en pSEO pagina's: dark navy achtergrond. Funnel cards (`/check`): wit/licht.

| Gebied | Waarde |
|--------|--------|
| Hero / pagina achtergrond | `#020617` (slate-950) → `#0f172a` (slate-900) gradient |
| Section achtergrond (afwisselend) | `#020617` / `#0f172a` |
| Card (glassmorphism, op donker) | `bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl` of `.glass-card-navy` |
| Card (funnel, op licht) | `bg-white border border-slate-200 rounded-2xl` |
| Amber CTA button | `bg-amber-500 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.4)] active:scale-105` |
| `amberBtnCls` pattern | `shadow-[0_0_35px_rgba(245,158,11,0.5)]` (sterkere glow variant in funnel) |
| Disabled button | `disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none` |
| Stats / highlight cijfers | `#f59e0b` (amber-500) |
| Urgentie strips (homepage, stad) | `background: rgba(28,18,8,0.95)` + `border-amber-500/20` + tekst `text-amber-300/80` — **geen rood** |
| Urgentie cards (Shock2027Banner, PDF) | `bg-amber-950/20 border-amber-500/25` — negatieve getallen mogen `text-red-400` blijven (semantisch) |
| Status ROOD | `bg-red-50 border-red-200 text-red-600` (licht) / `bg-red-950/50 border-red-700 text-red-400` (donker) — **alleen voor netcongestie ROOD status** |
| Status ORANJE | `bg-amber-50 border-amber-200 text-amber-600` (licht) / `bg-amber-950/50 border-amber-700 text-amber-400` (donker) |
| Status GROEN | `bg-emerald-50 border-emerald-200 text-emerald-600` (licht) / `bg-emerald-950/50 border-emerald-700 text-emerald-400` (donker) |
| SVG grid (hero only) | opacity 0.03, fade via `maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)'` |
| Input focus (donker) | `.amber-glow` class in globals.css — amber border + subtle glow |
| Print/PDF | `@media print` in globals.css, `.no-print` klasse op interactieve elementen |

Fonts (via `app/layout.tsx`, Next.js Google Fonts):
- **Bricolage Grotesque** — koppen (H1-H6), `var(--font-heading)`
- **DM Sans** — body tekst, labels, form fields, `var(--font-sans)` — **gebruik dit als default, niet font-mono**
- **ui-monospace** — uitsluitend voor numerieke data/scores/bedragen, `font-mono`

**Emoji-vrij**: geen emoji's in de UI. Gebruik altijd inline SVG iconen.

## Environment variables

Kopieer `.env.example` naar `.env.local` en vul in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MAPBOX_ACCESS_TOKEN=        # Server-side only (lib/bag.ts geocoding)
GOOGLE_AI_API_KEY=          # Gemini 2.5 Flash (screening + pSEO content + wijk seed)
ANTHROPIC_API_KEY=          # Claude claude-sonnet-4-6 (vision diepanalyse)
RESEND_API_KEY=             # Transactionele email (lead bevestiging)
EPONLINE_API_KEY=           # EP-online RVO (energie labels)
```

## NPM scripts

```bash
npm run dev               # Start dev server
npm run build             # Production build
npm run seed:netcongestie # Seed netcongestie_cache tabel
npm run seed:pseo         # Seed eerste batch pSEO adrespagina's
npm run seed:wijken       # 2000-wijk seed via Gemini (gebruik --batch=0,50 per run)
npx playwright test       # E2E tests draaien (dev server moet actief zijn)
```

## Handmatige DB-fixes (eenmalig uitvoeren in Supabase SQL editor)

```sql
-- Fix Issue 6: Bergen op Zoom wijken op ROOD zetten (postcode 4600-4799 = ROOD per CONGESTION_SEED)
UPDATE pseo_pages
SET netcongestie_status = 'ROOD'
WHERE stad = 'bergen-op-zoom' AND provincie = 'noord-brabant';
```

## Verificatie checklist

- `curl /api/bag?adres=Prinsengracht+123+Amsterdam` → BAG JSON
- ROI voor 1975 rijtjeshuis (110m²) → €400-800/jaar besparing
- ROI voor pre-1800 pand (bouwjaar 1635) → werkt zonder 400 error
- Homepage adres invoeren → redirect naar `/check?adres=...` → auto-zoek triggered
- Homepage countdown timer telt af (niet `--`)
- `/check?wijk=IJburg&stad=Amsterdam` → Step 1 AnalysisLoading toont "Netcapaciteit IJburg verifiëren..."
- Step 6: naam vereist 2 woorden, telefoonnummer toont live groen preview na validatie
- Step 6 submit → SuccessState toont ResultsDashboard met ShockChart + ROITijdlijn
- Favicon zichtbaar in browsertabblad (niet Vercel logo)
- Homepage urgentie strip is amber (niet rood)
- pSEO straat-route laadt met JSON-LD in `<head>`
- pSEO wijk-route (`/utrecht/utrecht/leidsche-rijn`) laadt na seed, breadcrumb aanwezig
- Provincie pagina (`/noord-holland`) → grid van alle steden
- Stad pagina (`/noord-holland/amsterdam`) → grid van alle wijken
- GDPR checkbox niet aangevinkt → submit geblokkeerd
- 6e identiek request zelfde IP op zelfde route → 429 met `Retry-After: 3600`
- Lead zonder `gdpr_consent` → webhook nooit verstuurd
- `/sitemap/noord-holland.xml` → Noord-Holland URLs incl. provincie + stad URLs
- Vision: verkeerde foto → 422 screening error, juiste foto → analyse JSON
- `npx playwright test` → 9 tests passing
