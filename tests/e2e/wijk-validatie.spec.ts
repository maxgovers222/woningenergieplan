import { test, expect } from '@playwright/test'

/**
 * Gebruik alleen wijken/straten die aantoonbaar in de DB zitten (golden batch).
 * Voeg meer toe zodra seed:wijken / seed:pseo meer pagina's genereert.
 */
const WIJK_URLS = [
  '/utrecht/utrecht/leidsche-rijn',
  '/overijssel/zwolle/stadshagen',
]

/**
 * Straat-URLs: pas aan met bekende geseedde straten.
 * Voer `SELECT slug FROM pseo_pages WHERE straat IS NOT NULL LIMIT 5` uit in Supabase
 * om bekende slugs te vinden en hier in te vullen.
 */
const STRAAT_URLS: string[] = [
  // Vul aan met bekende geseedde straat-slugs, bijv:
  // '/utrecht/utrecht/leidsche-rijn/parkwijk-noord',
]

const NET_BADGE_TEXTS = ['ROOD', 'ORANJE', 'GROEN']

for (const url of WIJK_URLS.slice(0, 6)) {
  test(`Wijk pagina laadt correct: ${url}`, async ({ page }) => {
    const response = await page.goto(url)

    // Pagina moet 200 teruggeven (niet 404)
    expect(response?.status()).not.toBe(404)

    // <h1> moet zichtbaar zijn en niet leeg
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
    const h1Text = await h1.innerText()
    expect(h1Text.trim().length).toBeGreaterThan(2)

    // Netcongestie indicator: één van de drie statussen moet zichtbaar zijn
    const hasNetBadge = await page.evaluate((texts) => {
      const body = document.body.innerText
      return texts.some(t => body.includes(t))
    }, NET_BADGE_TEXTS)
    expect(hasNetBadge).toBe(true)

    // Data ribbon aanwezig (3 kaarten)
    const ribbonCards = page.locator('text=Grid Status')
    await expect(ribbonCards.first()).toBeVisible()
  })
}

// Straat-pagina tests (alleen als STRAAT_URLS gevuld is)
for (const url of STRAAT_URLS) {
  test(`Straat pagina laadt correct: ${url}`, async ({ page }) => {
    const response = await page.goto(url)

    // Pagina moet 200 teruggeven (niet 404)
    expect(response?.status()).not.toBe(404)

    // <h1> zichtbaar en niet leeg
    const h1 = page.locator('h1').first()
    await expect(h1).toBeVisible()
    const h1Text = await h1.innerText()
    expect(h1Text.trim().length).toBeGreaterThan(2)

    // Breadcrumb aanwezig (back-link naar wijk)
    const breadcrumb = page.locator('nav').filter({ hasText: 'Home' }).first()
    await expect(breadcrumb).toBeVisible({ timeout: 5000 })

    // CTA knop aanwezig
    await expect(page.locator('a:has-text("Check uw woning")').first()).toBeVisible()
  })
}
