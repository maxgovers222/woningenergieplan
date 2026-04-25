// lib/roi.ts

// Saldering afbouwschema NL (configurabel)
export const SALDERING_SCHEMA: Record<number, number> = {
  2025: 0.64,
  2026: 0.28,  // 72% niet meer vergoed
  2027: 0.00,  // Volledig einde saldering
}

// Dynamische tarieven 2026
const LEVERINGSTARIEF = 0.40   // €/kWh inkoop
const TERUGLEVERTARIEF = 0.09  // €/kWh uitkoop (marktprijs)
const KWH_PER_PANEEL = 350     // kWh/jaar per 400Wp paneel NL gemiddeld
const M2_PER_PANEEL = 4        // m² dakoppervlak per paneel (incl. tussenruimte)
const DAK_BENUTTING = 0.55     // 55% van dakoppervlak bruikbaar (realistisch: niet alle vlakken zijn zuidgericht)

const DAKRICHTING_FACTOR: Record<string, number> = {
  'Zuid': 1.23,
  'Oost/West': 0.80,
  'Noord': 0.43,
}

const EIGENGEBRUIK_BASIS: Record<number, number> = { 1: 0.22, 2: 0.30, 3: 0.45 }
const EIGENGEBRUIK_BATTERIJ: Record<number, number> = { 1: 0.55, 2: 0.70, 3: 0.80 }

export interface ROIInput {
  oppervlakte: number          // Woonoppervlak m²
  bouwjaar: number
  dakOppervlakte: number       // Geschat dakoppervlak m²
  huidigVerbruikKwh?: number   // Optioneel: overschrijft schatting
  budgetEur?: number           // Optioneel: max investering
  aantalPanelenOverride?: number // Optioneel: gebruiker overschrijft paneel berekening
  kwhPerPaneel?: number        // Optioneel: paneelefficiëntie (standaard 350)
  dakrichting?: 'Zuid' | 'Oost/West' | 'Noord' | null
  huishouden_grootte?: 1 | 2 | 3 | null
}

export interface ShockEffect2027 {
  jaarlijksVerlies: number          // €/jaar verlies na 1 jan 2027 zonder actie
  cumulatiefVerlies5Jaar: number    // × 5 jaar
  maandelijksVerlies: number        // jaarlijksVerlies / 12
  boodschap: string                 // Human-readable urgentieboodschap
}

export interface ROIScenario {
  naam: string
  beschrijving: string
  besparingJaarEur: number
  investeringEur: number
  terugverdientijdJaar: number
}

export interface ROIResult {
  // Kerngetallen
  geschatVerbruikKwh: number
  aantalPanelen: number
  productieKwh: number
  eigenGebruikPct: number         // % van productie dat direct gebruikt wordt

  // Scenario's
  scenarioNu: ROIScenario         // Panelen nu installeren (2026 saldering 28%)
  scenarioMetBatterij: ROIScenario // Panelen + batterij (hogere eigengebruik)
  scenarioWachten: ROIScenario    // Wachten tot 2027 (geen saldering meer)

  // 2027 urgentie
  shockEffect2027: ShockEffect2027

  // Aanbeveling
  aanbeveling: 'panelen' | 'beide'
  aanbevelingTekst: string

  // Subsidie pre-fill
  isdeSchatting: {
    bedragEur: number
    apparaatType: string
    vermogenKwp: number
  }
}

// Schat jaarverbruik op basis van woonoppervlak en bouwjaar
export function schatVerbruik(oppervlakte: number, bouwjaar: number): number {
  // Basisverbruik per m² daalt naarmate woning nieuwer is
  let kwh_per_m2: number
  if (bouwjaar < 1970) kwh_per_m2 = 18
  else if (bouwjaar < 1990) kwh_per_m2 = 14
  else if (bouwjaar < 2010) kwh_per_m2 = 11
  else kwh_per_m2 = 8

  // Basisverbruik (apparaten, verlichting) + verwarmingsdeel
  return Math.round(oppervlakte * kwh_per_m2 + 800)
}

export function berekenROI(input: ROIInput): ROIResult {
  const verbruikKwh = input.huidigVerbruikKwh ?? schatVerbruik(input.oppervlakte, input.bouwjaar)

  const aantalPanelen = input.aantalPanelenOverride
    ?? Math.floor((input.dakOppervlakte * DAK_BENUTTING) / M2_PER_PANEEL)
  const kwhPerPaneel = input.kwhPerPaneel ?? KWH_PER_PANEEL
  const richtingFactor = input.dakrichting ? (DAKRICHTING_FACTOR[input.dakrichting] ?? 1.0) : 1.0
  const productieKwh = Math.round(aantalPanelen * kwhPerPaneel * richtingFactor)
  const saldering2026 = SALDERING_SCHEMA[2026]

  // Eigengebruik factor op basis van huishoudenssamenstelling
  const basisFactor = input.huishouden_grootte ? (EIGENGEBRUIK_BASIS[input.huishouden_grootte] ?? 0.30) : 0.30
  const batterijFactor = input.huishouden_grootte ? (EIGENGEBRUIK_BATTERIJ[input.huishouden_grootte] ?? 0.70) : 0.70

  const eigenGebruikBasisKwh = Math.min(productieKwh * basisFactor, verbruikKwh)
  const teruglevering = productieKwh - eigenGebruikBasisKwh

  const eigenGebruikBatterijKwh = Math.min(productieKwh * batterijFactor, verbruikKwh)
  const terugleveringBatterij = productieKwh - eigenGebruikBatterijKwh

  // Scenario A: Nu installeren (2026, 28% saldering)
  // Saldering: gesalderd deel vergoed tegen LEVERINGSTARIEF, rest tegen marktprijs
  const besparingNu =
    eigenGebruikBasisKwh * LEVERINGSTARIEF +
    teruglevering * saldering2026 * LEVERINGSTARIEF +
    teruglevering * (1 - saldering2026) * TERUGLEVERTARIEF
  const investeringPanelen = aantalPanelen * 350  // ~€350 per paneel geïnstalleerd

  // Scenario B: Met batterij (10 kWh, ~€4000)
  const besparingMetBatterij =
    eigenGebruikBatterijKwh * LEVERINGSTARIEF +
    terugleveringBatterij * saldering2026 * LEVERINGSTARIEF +
    terugleveringBatterij * (1 - saldering2026) * TERUGLEVERTARIEF
  const investeringMetBatterij = investeringPanelen + 4000

  // Scenario C: Wachten tot 2027 (0% saldering, alleen eigengebruik spaart)
  const besparingWachten = eigenGebruikBasisKwh * LEVERINGSTARIEF

  // 2027 shock-effect: verlies t.o.v. NU handelen
  const jaarlijksVerlies = besparingNu - besparingWachten
  const shockEffect2027: ShockEffect2027 = {
    jaarlijksVerlies: Math.round(jaarlijksVerlies),
    cumulatiefVerlies5Jaar: Math.round(jaarlijksVerlies * 5),
    maandelijksVerlies: Math.round(jaarlijksVerlies / 12),
    boodschap: `Zonder actie verlies je €${Math.round(jaarlijksVerlies)} per jaar na 1 januari 2027`,
  }

  // Aanbeveling
  const aanbeveling = besparingMetBatterij > besparingNu * 1.2 ? 'beide' : 'panelen'

  // ISDE schatting (2026 tarieven): batterij €250/kWh subsidie tot max 10 kWh
  const isdeSchatting = {
    bedragEur: aanbeveling === 'beide' ? 2500 : 0,
    apparaatType: aanbeveling === 'beide' ? 'Thuisbatterij' : 'Zonnepanelen',
    vermogenKwp: Math.round(aantalPanelen * 0.4 * 10) / 10,  // kWp = panelen × 400Wp
  }

  return {
    geschatVerbruikKwh: verbruikKwh,
    aantalPanelen,
    productieKwh,
    eigenGebruikPct: productieKwh > 0 ? Math.round((eigenGebruikBasisKwh / productieKwh) * 100) : 0,

    scenarioNu: {
      naam: 'Nu installeren',
      beschrijving: 'Zonnepanelen in 2026 (28% saldering)',
      besparingJaarEur: Math.round(besparingNu),
      investeringEur: investeringPanelen,
      terugverdientijdJaar: Math.round((investeringPanelen / besparingNu) * 10) / 10,
    },
    scenarioMetBatterij: {
      naam: 'Panelen + batterij',
      beschrijving: 'Zonnepanelen + 10 kWh thuisbatterij',
      besparingJaarEur: Math.round(besparingMetBatterij),
      investeringEur: investeringMetBatterij,
      terugverdientijdJaar: Math.round((investeringMetBatterij / besparingMetBatterij) * 10) / 10,
    },
    scenarioWachten: {
      naam: 'Wachten tot 2027',
      beschrijving: 'Na einde saldering (0% vergoeding teruglevering)',
      besparingJaarEur: Math.round(besparingWachten),
      investeringEur: investeringPanelen,
      terugverdientijdJaar: besparingWachten > 0
        ? Math.round((investeringPanelen / besparingWachten) * 10) / 10
        : 99,
    },

    shockEffect2027,
    aanbeveling,
    aanbevelingTekst: aanbeveling === 'beide'
      ? `Met panelen én batterij bespaar je €${Math.round(besparingMetBatterij)}/jaar. De batterij verdient zichzelf terug vóór 2030.`
      : `Zonnepanelen leveren je €${Math.round(besparingNu)}/jaar op. Installeer vóór 1 jan 2027 om de resterende salderingsvoordelen te benutten.`,
    isdeSchatting,
  }
}
