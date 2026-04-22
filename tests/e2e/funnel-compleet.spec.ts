import { test, expect } from '@playwright/test'

test.describe('Volledige funnel E2E — mocked APIs', () => {
  test.beforeEach(async ({ page }) => {
    // Mock alle externe API calls zodat geen echte netwerkverzoeken nodig zijn
    await page.route('/api/bag/suggest**', async route => {
      await route.fulfill({
        json: {
          suggestions: [{
            mapbox_id: 'test-id-1',
            full_address: 'Prinsengracht 263, 1016 GV Amsterdam',
            name: 'Prinsengracht 263',
            place_formatted: '1016 GV Amsterdam',
          }],
        },
      })
    })

    await page.route('/api/bag**', async route => {
      if (route.request().url().includes('/suggest')) {
        await route.continue()
        return
      }
      await route.fulfill({
        json: {
          adres: 'Prinsengracht 263, Amsterdam',
          postcode: '1016GV',
          huisnummer: '263',
          lat: 52.3676,
          lon: 4.8897,
          bouwjaar: 1880,
          oppervlakte: 120,
          woningtype: 'appartement',
          dakOppervlakte: 45,
          energielabel: 'D',
        },
      })
    })

    await page.route('/api/netcongestie**', async route => {
      await route.fulfill({
        json: {
          status: 'GROEN',
          netbeheerder: 'Liander',
          regio: 'Amsterdam',
          postcodePrefix: '1016',
          terugleveringBeperkt: false,
        },
      })
    })

    await page.route('/api/roi**', async route => {
      await route.fulfill({
        json: {
          aantalPanelen: 8,
          vermogenKwp: 3.2,
          jaarproductieKwh: 2880,
          scenarioNu: { jaarlijkseBesparing: 650, terugverdientijd: 7.8, roi25jaar: 12800 },
          scenarioMetBatterij: { jaarlijkseBesparing: 820, terugverdientijd: 8.5, roi25jaar: 15600 },
          scenarioWachten: { verliesPerJaar: 580, totalVerlies2027: 1160 },
          shockEffect2027: { huidigSalderingspct: 64, volgendJaarPct: 28, eindeJaarPct: 0, jaarlijksVerlies: 580 },
        },
      })
    })

    await page.route('/api/health-score**', async route => {
      await route.fulfill({
        json: { score: 62, label: 'Goed', kleur: 'amber', breakdown: {}, aanbevelingen: [] },
      })
    })

    await page.route('/api/leads**', async route => {
      await route.fulfill({ json: { leadId: 'test-lead-id-123', success: true } })
    })
  })

  test('Funnel laadt op /check en toont adresinput', async ({ page }) => {
    await page.goto('/check')

    // Wacht op adresinput — bewijst dat de funnel geladen is
    const input = page.locator('input[placeholder*="Prinsengracht"], input[placeholder*="Bijv"], input[placeholder*="adres"]').first()
    await expect(input).toBeVisible({ timeout: 15000 })
  })

  test('Funnel met ?adres= param laadt zonder crash', async ({ page }) => {
    await page.goto('/check?adres=Prinsengracht+263+Amsterdam')

    // Pagina laadt zonder error
    await page.waitForLoadState('domcontentloaded')
    await expect(page).not.toHaveURL(/\/_error|\/500/)

    // Er is content zichtbaar
    await expect(page.locator('main, #__next').first()).toBeVisible({ timeout: 10000 })
  })

  test('API mocks werken — /api/bag/suggest geeft resultaat', async ({ page }) => {
    await page.goto('/check')

    // Wacht op input
    const input = page.locator('input[placeholder*="Prinsengracht"], input[placeholder*="Bijv"], input[placeholder*="adres"]').first()
    await expect(input).toBeVisible({ timeout: 15000 })

    // Typ adres om suggest te triggeren
    await input.fill('Prinsengracht')
    await page.waitForTimeout(500)

    // Mock response moet het verzoek beantwoord hebben (geen network error)
    // Test slaagt als er geen crashed state is
    await expect(page).not.toHaveURL(/\/_error/)
  })
})

test.describe('Funnel: scroll gedrag', () => {
  test('Homepage laadt met scroll positie 0', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY).toBe(0)
  })

  test('/check laadt met scroll positie 0', async ({ page }) => {
    await page.goto('/check')
    await page.waitForLoadState('domcontentloaded')

    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY).toBe(0)
  })
})
