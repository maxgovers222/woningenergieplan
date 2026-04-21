'use client'

// Local type mirrors — do NOT import from lib/roi or lib/health-score (server-only)

export interface ShockEffect2027 {
  jaarlijksVerlies: number
  cumulatiefVerlies5Jaar: number
  maandelijksVerlies: number
  boodschap: string
}

export interface ROIScenario {
  naam: string
  beschrijving: string
  besparingJaarEur: number
  investeringEur: number
  terugverdientijdJaar: number
}

export interface ROIResult {
  geschatVerbruikKwh: number
  aantalPanelen: number
  productieKwh: number
  eigenGebruikPct: number
  scenarioNu: ROIScenario
  scenarioMetBatterij: ROIScenario
  scenarioWachten: ROIScenario
  shockEffect2027: ShockEffect2027
  aanbeveling: 'panelen' | 'beide'
  aanbevelingTekst: string
  isdeSchatting: {
    bedragEur: number
    apparaatType: string
    vermogenKwp: number
  }
}

export interface HealthScoreResult {
  score: number
  label: 'Uitstekend' | 'Goed' | 'Matig' | 'Slecht'
  kleur: 'groen' | 'geel' | 'oranje' | 'rood'
  breakdown: {
    bouwjaar: number
    energielabel: number
    dakpotentieel: number
    netcongestie: number
  }
  aanbevelingen: string[]
}

export interface MeterkastAnalyse {
  merk: string | null
  drieFase: boolean
  vrijeGroepen: number
  maxVermogenKw: number | null
  geschikt: boolean
  opmerkingen: string[]
}

export interface PlaatsingsAnalyse {
  nenCompliant: boolean
  risicoItems: string[]
  aanbevelingen: string[]
  geschiktheidScore: number
}

export interface OmvormerAnalyse {
  merk: string | null
  model: string | null
  vermogenKw: number | null
  hybrideKlaar: boolean
  vervangenNodig: boolean
  opmerkingen: string[]
}

export interface FunnelState {
  step: 1 | 2 | 3 | 4 | 5 | 6
  adres: string
  wijk: string
  stad: string
  bagData: {
    bouwjaar: number | null
    oppervlakte: number | null
    woningtype: string | null
    postcode: string | null
    dakOppervlakte: number | null
    lat: number
    lon: number
  } | null
  netcongestie: {
    status: 'ROOD' | 'ORANJE' | 'GROEN'
    netbeheerder: string
    uitleg: string
    terugleveringBeperkt: boolean
    postcodePrefix?: string
  } | null
  healthScore: HealthScoreResult | null
  roiResult: ROIResult | null
  meterkastAnalyse: MeterkastAnalyse | null
  plaatsingsAnalyse: PlaatsingsAnalyse | null
  omvormerAnalyse: OmvormerAnalyse | null
  leadId: string | null
  loading: boolean
  error: string | null
  utmParams: {
    source: string | null
    medium: string | null
    campaign: string | null
    landingPage: string | null
  } | null
}

export type FunnelAction =
  | { type: 'SET_STEP'; step: FunnelState['step'] }
  | { type: 'SET_WIJK'; wijk: string; stad: string }
  | { type: 'SET_BAG_DATA'; bagData: FunnelState['bagData'] }
  | { type: 'SET_NETCONGESTIE'; netcongestie: FunnelState['netcongestie'] }
  | { type: 'SET_HEALTH_SCORE'; healthScore: HealthScoreResult }
  | { type: 'SET_ROI'; roiResult: ROIResult }
  | { type: 'SET_METERKAST'; meterkastAnalyse: MeterkastAnalyse | null }
  | { type: 'SET_PLAATSING'; plaatsingsAnalyse: PlaatsingsAnalyse | null }
  | { type: 'SET_OMVORMER'; omvormerAnalyse: OmvormerAnalyse | null }
  | { type: 'SET_LEAD_ID'; leadId: string }
  | { type: 'SET_ADRES'; adres: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_UTM_PARAMS'; utmParams: FunnelState['utmParams'] }
