import activitiesFile from './activities.json' with { type: 'json' }
import { contentBand, PROFILE_LABEL, type DimensionScore, type ProfileTendency, type ScoreReport, type Severity } from '../engine/score.ts'

export interface ActivityDef {
  id: string
  phase: 'warmup' | 'spark' | 'winddown' | 'offline'
  kind: string
  title: string
  minutes: number
  summary: string
  offline: string
  api: string | null
}

interface MatrixFile {
  notice: string
  activities: ActivityDef[]
  matrix: Record<string, Record<string, Record<string, string[]>>>
}

const file = activitiesFile as MatrixFile

const SPARK_BY_DIMENSION: Record<string, string> = {
  phonological: 'spark-rhyme',
  decoding: 'spark-voice',
  naming: 'spark-naming',
  orthographic: 'spark-voice',
  fluency: 'spark-voice',
  workingMemory: 'spark-puzzle',
  attention: 'spark-puzzle',
  reasoning: 'spark-puzzle',
}

export interface BuiltActivity extends ActivityDef {
  audio: boolean
  showTimer: boolean
}

export interface DailySession {
  totalMinutes: number
  severity: Severity
  profile: ProfileTendency
  profileLabel: string
  targetSkills: string[]
  activities: BuiltActivity[]
  offline: string[]
  specialistPrompt: boolean
  cappedByScreenTime: boolean
  note: string
}

function byId(id: string): ActivityDef | undefined {
  return file.activities.find((item) => item.id === id)
}

function plannedMinutes(severity: Severity): number {
  if (severity === 'severe') return 8
  if (severity === 'moderate') return 12
  return 18
}

export function offlineFor(profile: ProfileTendency, age: number, severity: Severity): string[] {
  const band = contentBand(age)
  const ids = file.matrix[profile]?.[band]?.[severity] ?? file.matrix.phonological[band][severity]
  const lines = ids.map((id) => byId(id)?.offline).filter((line): line is string => !!line)
  const extras = ['Phonics stays the base: say a sound, then find a letter that spells it.', 'Beat your own score next time. There is no ranking against anyone else.']
  return [...new Set([...lines, ...extras])].slice(0, 3)
}

export function parentTips(profile: ProfileTendency): string[] {
  const tips: Record<ProfileTendency, string[]> = {
    phonological: ['Five minutes of echo reading before bed.', 'Clap syllables in snack words, then blend them again.'],
    'surface-orthographic': ['Keep three tricky-word cards on the fridge.', 'Read the same short picture story two nights in a row.'],
    'rapid-naming': ['Name colours in the room, then try to beat yesterday’s count.', 'Echo one sentence: you read it, then your child reads it.'],
    'double-deficit': ['Shorter turns. More repetition. Point to the words while you read.'],
    mixed: ['One sound game and one word-memory game is enough for tonight.'],
    'no-clear-pattern': ['Shared reading is the best default. Keep phonics playful.'],
  }
  return tips[profile]
}

export function buildSession(report: ScoreReport, age: number, remainingMinutes: number): DailySession {
  const profile = report.risk === 'unclear' ? 'phonological' : report.profile
  const severity = report.severity
  const band = contentBand(age)
  const ids = file.matrix[profile]?.[band]?.[severity] ?? file.matrix.phonological[band].mild
  const chosen = ids.map((id) => byId(id)).filter((item): item is ActivityDef => !!item)
  const strongest = [...report.dimensions]
    .filter((dim) => dim.status === 'scored' && dim.z !== null && dim.id !== 'questionnaire')
    .sort((a: DimensionScore, b: DimensionScore) => (b.z ?? 0) - (a.z ?? 0))[0]
  const spark = byId(SPARK_BY_DIMENSION[strongest?.id ?? 'phonological'] ?? 'spark-rhyme')
  const warmup = chosen.find((item) => item.phase === 'warmup') ?? byId('warmup-letters')!
  const wind = chosen.find((item) => item.phase === 'winddown') ?? byId('wind-story')!
  const audio = severity !== 'mild'
  const showTimer = severity !== 'severe'
  const wanted = plannedMinutes(severity)
  const totalMinutes = Math.max(0, Math.min(wanted, Math.floor(remainingMinutes)))
  const cappedByScreenTime = totalMinutes < wanted
  const offline = offlineFor(profile, age, severity)
  const targetSkills = [report.mainNeed, severity === 'mild' ? null : report.secondaryNeed].filter((item): item is string => !!item)
  if (totalMinutes < 5) {
    return {
      totalMinutes,
      severity,
      profile,
      profileLabel: PROFILE_LABEL[profile],
      targetSkills,
      activities: [],
      offline,
      specialistPrompt: severity === 'severe' || report.risk === 'high',
      cappedByScreenTime: true,
      note: 'Not enough screen time left today. Use the offline play instead.',
    }
  }
  const share = [0.3, 0.3, 0.4]
  const parts = [warmup, spark ?? warmup, wind]
  const activities: BuiltActivity[] = parts.map((item, index) => ({
    ...item,
    minutes: Math.max(2, Math.round(totalMinutes * share[index])),
    audio,
    showTimer,
  }))
  return {
    totalMinutes,
    severity,
    profile,
    profileLabel: PROFILE_LABEL[profile],
    targetSkills,
    activities,
    offline,
    specialistPrompt: severity === 'severe' || report.risk === 'high',
    cappedByScreenTime,
    note: severity === 'severe'
      ? 'Very short bursts, audio on, no race timer inside the games. A specialist visit is the priority.'
      : severity === 'moderate'
        ? 'Two target skills, extra repetition, and audio on the text.'
        : 'One target skill, with difficulty kept gentle.',
  }
}

export function listActivities(): ActivityDef[] {
  return file.activities
}

export function activityById(id: string): ActivityDef | undefined {
  return byId(id)
}
