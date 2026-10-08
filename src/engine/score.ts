import { CONFIDENCE, DISCLAIMER, NORMS_NOTE } from '../copy.ts'

export type RiskLevel = 'low' | 'medium' | 'high' | 'unclear'
export type ProfileTendency =
  | 'phonological'
  | 'surface-orthographic'
  | 'rapid-naming'
  | 'double-deficit'
  | 'mixed'
  | 'no-clear-pattern'
export type Severity = 'mild' | 'moderate' | 'severe'
export type Flag = 'none' | 'flagged' | 'strong'
export type DimensionStatus = 'scored' | 'unreliable' | 'not-applicable'

export interface NormCell {
  mean: number
  sd: number
  higherIsBetter: boolean
}

export interface NormTable {
  demo: true
  notice: string
  bands: Record<string, Record<string, NormCell>>
}

export interface WeightConfig {
  phonological: number
  decoding: number
  naming: number
  orthographic: number
  fluency: number
  workingMemory: number
  questionnaire: number
}

export interface TaskSignal {
  taskId: string
  raw: number
  reliable: boolean
}

export interface ScoreInput {
  age: number
  tasks: TaskSignal[]
  norms: NormTable
  weights: WeightConfig
  unclearThreshold?: number
}

export interface DimensionScore {
  id: string
  label: string
  shortLabel: string
  z: number | null
  status: DimensionStatus
  flag: Flag
  inRisk: boolean
}

export interface ScoreReport {
  risk: RiskLevel
  severity: Severity
  profile: ProfileTendency
  confidenceNote: string
  compositeZ: number | null
  dimensions: DimensionScore[]
  strengths: string[]
  mainNeed: string | null
  secondaryNeed: string | null
  notes: string[]
  explanation: string
  nextSteps: string[]
  normsNotice: string
  disclaimer: string
}

interface Group {
  id: string
  label: string
  shortLabel: string
  tasks: string[]
  inRisk: boolean
  weightKey?: keyof WeightConfig
}

const GROUPS: Group[] = [
  { id: 'phonological', label: 'Phonological awareness', shortLabel: 'Sounds', tasks: ['T1', 'T2', 'T3'], inRisk: true, weightKey: 'phonological' },
  { id: 'decoding', label: 'Decoding', shortLabel: 'Decoding', tasks: ['T4'], inRisk: true, weightKey: 'decoding' },
  { id: 'naming', label: 'Rapid naming', shortLabel: 'Naming', tasks: ['T5'], inRisk: true, weightKey: 'naming' },
  { id: 'orthographic', label: 'Word recognition and spelling', shortLabel: 'Word memory', tasks: ['T6', 'T7'], inRisk: true, weightKey: 'orthographic' },
  { id: 'fluency', label: 'Reading fluency', shortLabel: 'Fluency', tasks: ['T10'], inRisk: true, weightKey: 'fluency' },
  { id: 'workingMemory', label: 'Working memory', shortLabel: 'Memory', tasks: ['T8'], inRisk: true, weightKey: 'workingMemory' },
  { id: 'attention', label: 'Attention', shortLabel: 'Attention', tasks: ['T9'], inRisk: false },
  { id: 'reasoning', label: 'Reasoning control', shortLabel: 'Reasoning', tasks: ['T12'], inRisk: false },
  { id: 'questionnaire', label: 'Family and school clues', shortLabel: 'Home clues', tasks: ['Q'], inRisk: true, weightKey: 'questionnaire' },
]

export function normBand(age: number): string {
  if (age <= 6) return '5-6'
  if (age <= 8) return '7-8'
  if (age <= 10) return '9-10'
  return '11-13'
}

export function contentBand(age: number): '5-7' | '8-10' | '11-13' {
  if (age <= 7) return '5-7'
  if (age <= 10) return '8-10'
  return '11-13'
}

export function zOf(raw: number, cell: NormCell): number {
  if (cell.sd === 0) return 0
  const z = (raw - cell.mean) / cell.sd
  return cell.higherIsBetter ? z : -z
}

function flagOf(z: number): Flag {
  if (z <= -1.5) return 'strong'
  if (z <= -1) return 'flagged'
  return 'none'
}

function isLow(dim: DimensionScore | undefined): boolean {
  return !!dim && dim.status === 'scored' && dim.flag !== 'none'
}

function tendency(dims: Map<string, DimensionScore>): ProfileTendency {
  const phono = dims.get('phonological')
  const decoding = dims.get('decoding')
  const ortho = dims.get('orthographic')
  const naming = dims.get('naming')
  const phonoLow = isLow(phono) || isLow(decoding)
  const orthoLow = isLow(ortho)
  const nameLow = isLow(naming)
  const decentDecoding = !!decoding && decoding.status === 'scored' && (decoding.z ?? -2) > -1
  if (phonoLow && nameLow) return 'double-deficit'
  if (orthoLow && decentDecoding && !phonoLow && !nameLow) return 'surface-orthographic'
  if (nameLow && !phonoLow && !orthoLow) return 'rapid-naming'
  if (phonoLow && !nameLow && !orthoLow) return 'phonological'
  if ([phonoLow, orthoLow, nameLow].filter(Boolean).length >= 2) return 'mixed'
  if (phonoLow) return 'phonological'
  if (orthoLow) return 'surface-orthographic'
  if (nameLow) return 'rapid-naming'
  return 'no-clear-pattern'
}

function explanation(risk: RiskLevel, profile: ProfileTendency): string {
  const pattern =
    profile === 'no-clear-pattern'
      ? 'No single reading-skill pattern stood out.'
      : `The skill pattern leans toward a ${PROFILE_LABEL[profile].toLowerCase()}.`
  if (risk === 'unclear') {
    return 'The check does not have enough reliable signals to estimate risk. Please retake it when the room is quiet and your child is comfortable. This is not a diagnosis.'
  }
  if (risk === 'low') {
    return `${pattern} Screening risk is low. Keep reading together. This is not a diagnosis.`
  }
  if (risk === 'medium') {
    return `${pattern} Screening risk is medium. Use the daily plan and re-check in 4 to 8 weeks. Mention it to a clinician if worries continue. This is not a diagnosis.`
  }
  return `${pattern} Screening risk is high. A clinical assessment is recommended. This is not a diagnosis.`
}

function nextSteps(risk: RiskLevel): string[] {
  if (risk === 'unclear') {
    return ['Retake the ChetnaDhara Check.', 'Pick a quiet moment when your child is willing.', 'Do not treat this sitting as a risk level.']
  }
  if (risk === 'low') {
    return ['Keep shared reading most days.', 'Use the daily plan if you want extra phonics play.', 'Come back if school raises a new concern.']
  }
  if (risk === 'medium') {
    return ['Run the daily plan in short sittings.', 'Re-check in 4 to 8 weeks.', 'If home or school worry continues, ask a clinician for advice.']
  }
  return ['Ask for a clinical assessment.', 'Use very short practice with instant encouragement.', 'Phonics stays the base while you wait for that visit.']
}

export function scoreScreening(input: ScoreInput): ScoreReport {
  const band = input.norms.bands[normBand(input.age)] ?? {}
  const byId = new Map(input.tasks.map((task) => [task.taskId, task]))
  const dimensions: DimensionScore[] = GROUPS.map((group) => {
    const present = group.tasks.map((id) => byId.get(id)).filter((task): task is TaskSignal => !!task)
    if (present.length === 0) {
      return { id: group.id, label: group.label, shortLabel: group.shortLabel, z: null, status: 'not-applicable', flag: 'none', inRisk: group.inRisk }
    }
    const reliable = present.filter((task) => task.reliable && band[task.taskId])
    if (reliable.length === 0) {
      return { id: group.id, label: group.label, shortLabel: group.shortLabel, z: null, status: 'unreliable', flag: 'none', inRisk: group.inRisk }
    }
    const zs = reliable.map((task) => zOf(task.raw, band[task.taskId]))
    const z = zs.reduce((sum, value) => sum + value, 0) / zs.length
    return { id: group.id, label: group.label, shortLabel: group.shortLabel, z, status: 'scored', flag: flagOf(z), inRisk: group.inRisk }
  })
  const dimMap = new Map(dimensions.map((dim) => [dim.id, dim]))
  const weighted = dimensions.filter((dim) => dim.inRisk && dim.status !== 'not-applicable')
  const unreliable = weighted.filter((dim) => dim.status === 'unreliable')
  const scored = weighted.filter((dim) => dim.status === 'scored')
  const threshold = input.unclearThreshold ?? 0.5
  const unclear = weighted.length === 0 || unreliable.length / weighted.length > threshold || scored.length < 2

  let compositeZ: number | null = null
  if (scored.length > 0) {
    let weightSum = 0
    let acc = 0
    for (const dim of scored) {
      const group = GROUPS.find((item) => item.id === dim.id)
      const weight = group?.weightKey ? input.weights[group.weightKey] : 0
      if (weight <= 0 || dim.z === null) continue
      weightSum += weight
      acc += dim.z * weight
    }
    compositeZ = weightSum > 0 ? acc / weightSum : null
  }
  const severity: Severity = compositeZ !== null && compositeZ <= -1.5 ? 'severe' : compositeZ !== null && compositeZ <= -1 ? 'moderate' : 'mild'
  const flags = scored.filter((dim) => dim.flag !== 'none')
  const strong = flags.filter((dim) => dim.flag === 'strong')
  let risk: RiskLevel = 'low'
  if (unclear) risk = 'unclear'
  else if (flags.length >= 4 || strong.length >= 2) risk = 'high'
  else if (flags.length >= 2 || strong.length >= 1) risk = 'medium'

  const profile = risk === 'unclear' ? 'no-clear-pattern' : tendency(dimMap)
  const notes: string[] = []
  const attention = dimMap.get('attention')
  const reasoning = dimMap.get('reasoning')
  if (attention && attention.status === 'scored' && attention.flag !== 'none') {
    notes.push('An attention pattern showed up. Dyslexia and ADHD often co-occur. This is worth discussing with a doctor rather than reading every score as a reading-only pattern.')
  }
  if (reasoning && reasoning.status === 'scored' && (reasoning.z ?? 0) <= -1.5) {
    notes.push('Reasoning tasks were also hard. The reading scores may not be an isolated pattern. A clinician can help sort this out.')
  }
  if (profile === 'double-deficit' && risk !== 'unclear') {
    notes.push('Sounds and naming were both hard. Sessions stay shorter, with more repetition and audio alongside the words.')
  }

  const ranked = dimensions
    .filter((dim) => dim.status === 'scored' && dim.z !== null && dim.id !== 'questionnaire')
    .sort((a, b) => (b.z ?? 0) - (a.z ?? 0))
  const strengths = ranked.filter((dim) => (dim.z ?? 0) >= 0.25).slice(0, 2).map((dim) => dim.label)
  if (strengths.length === 0) strengths.push('Staying with the check')

  const needs = scored.filter((dim) => dim.id !== 'questionnaire').sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
  const confidenceBits = [CONFIDENCE]
  if (input.norms.demo) confidenceBits.push(input.norms.notice || NORMS_NOTE)
  if (unreliable.length > 0) confidenceBits.push('Some signals were unreliable, so this picture is less certain.')
  if (risk === 'unclear') confidenceBits.push('No profile tendency is being estimated from this sitting.')

  return {
    risk,
    severity: risk === 'unclear' ? 'mild' : severity,
    profile,
    confidenceNote: confidenceBits.join(' '),
    compositeZ,
    dimensions,
    strengths,
    mainNeed: needs[0]?.label ?? null,
    secondaryNeed: needs[1]?.label ?? null,
    notes,
    explanation: explanation(risk, profile),
    nextSteps: nextSteps(risk),
    normsNotice: input.norms.notice || NORMS_NOTE,
    disclaimer: DISCLAIMER,
  }
}

export const PROFILE_LABEL: Record<ProfileTendency, string> = {
  phonological: 'Phonological tendency',
  'surface-orthographic': 'Surface / orthographic tendency',
  'rapid-naming': 'Rapid-naming tendency',
  'double-deficit': 'Double-deficit tendency',
  mixed: 'Mixed tendency',
  'no-clear-pattern': 'No clear pattern',
}
