// lib/health-score.ts

export interface HealthScoreInput {
  bouwjaar: number
  energielabel?: string | null      // A++, A+, A, B, C, D, E, F, G
  dakOppervlakte?: number | null    // m²
  netcongestieStatus?: 'ROOD' | 'ORANJE' | 'GROEN' | null
}

export interface HealthScoreResult {
  score: number               // 0-100
  label: 'Uitstekend' | 'Goed' | 'Matig' | 'Slecht'
  kleur: 'groen' | 'geel' | 'oranje' | 'rood'
  breakdown: {
    bouwjaar: number          // max 30
    energielabel: number      // max 30
    dakpotentieel: number     // max 20
    netcongestie: number      // max 20
  }
  aanbevelingen: string[]
}

export function berekenHealthScore(input: HealthScoreInput): HealthScoreResult {
  // Bouwjaar (max 30 punten)
  let bouwjaarScore: number
  if (input.bouwjaar < 1970) bouwjaarScore = 10
  else if (input.bouwjaar < 1990) bouwjaarScore = 18
  else if (input.bouwjaar < 2010) bouwjaarScore = 24
  else bouwjaarScore = 30

  // Energielabel (max 30 punten)
  const labelScores: Record<string, number> = {
    'A++': 30, 'A+': 30, 'A': 28, 'B': 24, 'C': 20, 'D': 15, 'E': 10, 'F': 5, 'G': 0,
  }
  const labelScore = input.energielabel
    ? (labelScores[input.energielabel.toUpperCase()] ?? 10)
    : 10  // Onbekend: gemiddeld

  // Dakpotentieel (max 20 punten) — op basis van dakoppervlak
  let dakScore: number
  const dak = input.dakOppervlakte ?? 0
  if (dak >= 40) dakScore = 20
  else if (dak >= 25) dakScore = 15
  else if (dak >= 15) dakScore = 10
  else dakScore = 5

  // Netcongestie (max 20 punten)
  const congestieScores: Record<string, number> = { GROEN: 20, ORANJE: 10, ROOD: 5 }
  const congestieScore = input.netcongestieStatus
    ? (congestieScores[input.netcongestieStatus] ?? 10)
    : 10  // Onbekend

  const score = bouwjaarScore + labelScore + dakScore + congestieScore

  // Label en kleur
  let label: HealthScoreResult['label']
  let kleur: HealthScoreResult['kleur']
  if (score >= 75) { label = 'Uitstekend'; kleur = 'groen' }
  else if (score >= 55) { label = 'Goed'; kleur = 'geel' }
  else if (score >= 35) { label = 'Matig'; kleur = 'oranje' }
  else { label = 'Slecht'; kleur = 'rood' }

  // Aanbevelingen op basis van zwakste onderdelen
  const aanbevelingen: string[] = []
  if (bouwjaarScore < 20) aanbevelingen.push('Overweeg na-isolatie van dak, muren en vloer')
  if (labelScore < 20) aanbevelingen.push('Verbeter energielabel via warmtepomp of HR-ketel vervanging')
  if (dakScore < 15) aanbevelingen.push('Beperkt dakoppervlak — onderzoek oost/west oriëntatie panelen')
  if (congestieScore < 15) aanbevelingen.push('Netcongestie in uw regio — thuisbatterij vergroot zelfvoorzienendheid')

  return {
    score,
    label,
    kleur,
    breakdown: { bouwjaar: bouwjaarScore, energielabel: labelScore, dakpotentieel: dakScore, netcongestie: congestieScore },
    aanbevelingen,
  }
}
