# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: funnel-handshake.spec.ts >> Funnel URL handshake >> Countdown timer zichtbaar op /check
- Location: tests\e2e\funnel-handshake.spec.ts:21:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Uren')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Uren')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - navigation [ref=e3]:
      - generic [ref=e4]:
        - link "SaldeerScan.nl" [ref=e5] [cursor=pointer]:
          - /url: /
          - img [ref=e7]
          - generic [ref=e10]: SaldeerScan.nl
        - generic [ref=e11]: Gratis 2027 saldeercheck
    - generic [ref=e12]:
      - paragraph [ref=e14]: Nog 254 dagen — saldering eindigt 1 jan 2027
      - generic [ref=e15]:
        - progressbar "Stap 1 van 6" [ref=e16]:
          - generic [ref=e18]:
            - generic [ref=e19]:
              - generic [ref=e21]: "1"
              - generic [ref=e22]: Adres
            - generic [ref=e23]:
              - generic [ref=e25]: "2"
              - generic [ref=e26]: Besparing
            - generic [ref=e27]:
              - generic [ref=e29]: "3"
              - generic [ref=e30]: Meterkast
            - generic [ref=e31]:
              - generic [ref=e33]: "4"
              - generic [ref=e34]: Plaatsing
            - generic [ref=e35]:
              - generic [ref=e37]: "5"
              - generic [ref=e38]: Omvormer
            - generic [ref=e39]:
              - generic [ref=e41]: "6"
              - generic [ref=e42]: Aanvraag
        - generic [ref=e44]:
          - generic [ref=e45]:
            - paragraph [ref=e46]: Stap 1 — Adresverificatie
            - heading "Voer uw adres in" [level=2] [ref=e47]
            - paragraph [ref=e48]: Selecteer uw adres voor een nauwkeurige BAG-analyse
          - generic [ref=e49]:
            - textbox "Bijv. Prinsengracht 123, Amsterdam" [ref=e52]
            - button "Adres Analyseren" [disabled] [ref=e53]
  - button "Open Next.js Dev Tools" [ref=e59] [cursor=pointer]:
    - img [ref=e60]
  - alert [ref=e63]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Funnel URL handshake', () => {
  4  |   test('?wijk en ?stad worden opgepakt door FunnelContainer', async ({ page }) => {
  5  |     await page.goto('/check?wijk=leidsche-rijn&stad=utrecht')
  6  | 
  7  |     // Pagina laadt zonder crash
  8  |     await expect(page).toHaveURL(/\/check/)
  9  | 
  10 |     // Header aanwezig
  11 |     await expect(page.locator('text=SaldeerScan')).toBeVisible()
  12 | 
  13 |     // AnalysisLoading of Step 1 content zichtbaar
  14 |     // (bij aanwezige wijk param triggert auto-search)
  15 |     const funnelVisible = await page.locator('text=Adres').first().isVisible().catch(() => false)
  16 |       || await page.locator('text=Analyseren').first().isVisible().catch(() => false)
  17 |       || await page.locator('text=leidsche').first().isVisible({ timeout: 5000 }).catch(() => false)
  18 |     expect(funnelVisible).toBe(true)
  19 |   })
  20 | 
  21 |   test('Countdown timer zichtbaar op /check', async ({ page }) => {
  22 |     await page.goto('/check')
  23 | 
  24 |     // Timer labels aanwezig
  25 |     await expect(page.locator('text=Dagen')).toBeVisible()
> 26 |     await expect(page.locator('text=Uren')).toBeVisible()
     |                                             ^ Error: expect(locator).toBeVisible() failed
  27 | 
  28 |     // Saldering tekst aanwezig
  29 |     await expect(page.locator('text=Salderingsregeling eindigt over')).toBeVisible()
  30 |   })
  31 | 
  32 |   test('?adres param prefilled op /check', async ({ page }) => {
  33 |     await page.goto('/check?adres=Keizersgracht+1+Amsterdam')
  34 | 
  35 |     // Pagina laadt
  36 |     await expect(page.locator('text=SaldeerScan')).toBeVisible()
  37 | 
  38 |     // Funnel container aanwezig
  39 |     const container = page.locator('text=Saldeercheck').first()
  40 |     await expect(container).toBeVisible()
  41 |   })
  42 | })
  43 | 
```