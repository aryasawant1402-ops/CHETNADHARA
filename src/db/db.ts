import Dexie, { type Table } from 'dexie'
import type { ScoreReport } from '../engine/score.ts'

export interface ParentRecord {
  id: string
  name: string
  email: string
  pinHash: string
  consentAt: string | null
  createdAt: string
}

export interface VisualPref {
  spacing: 'tight' | 'cozy' | 'roomy'
  overlay: 'cream' | 'blue' | 'yellow'
}

export interface ChildRecord {
  id: string
  parentId: string
  nickname: string
  dob: string
  grade: string
  languagesHome: string
  languagesSchool: string
  vision: string
  hearing: string
  glasses: boolean
  conditions: string[]
  conditionsOther: string
  medications: string
  speechDelay: string
  milestones: string
  birthComplications: string
  familyHistory: string
  previousAssessments: string
  teacherConcerns: string
  visual: VisualPref
  createdAt: string
}

export interface TaskResult {
  taskId: string
  raw: number
  reliable: boolean
  metrics: Record<string, number>
}

export interface CheckRecord {
  id: string
  childId: string
  status: 'active' | 'complete'
  gateOk: boolean
  cursor: number
  results: TaskResult[]
  updatedAt: string
}

export interface ReportRecord {
  id: string
  childId: string
  createdAt: string
  age: number
  score: ScoreReport
}

export interface SessionRecord {
  id: string
  childId: string
  createdAt: string
  activityId: string
  title: string
  mood: number
  confidence: number
}

export interface ScreenRecord {
  id: string
  childId: string
  day: string
  usedSeconds: number
}

export interface SettingsRecord {
  id: string
  limits: Record<string, number>
}

export interface PhotoRecord {
  id: string
  childId: string
  createdAt: string
  blob: Blob
}

class ChetnaDB extends Dexie {
  parents!: Table<ParentRecord, string>
  children!: Table<ChildRecord, string>
  checks!: Table<CheckRecord, string>
  reports!: Table<ReportRecord, string>
  sessions!: Table<SessionRecord, string>
  screenTime!: Table<ScreenRecord, string>
  settings!: Table<SettingsRecord, string>
  photos!: Table<PhotoRecord, string>

  constructor() {
    super('chetnadhara')
    this.version(1).stores({
      parents: 'id, email',
      children: 'id, parentId',
      checks: 'id, childId, status',
      reports: 'id, childId, createdAt',
      sessions: 'id, childId, createdAt',
      screenTime: 'id, childId, day',
      settings: 'id',
      photos: 'id, childId',
    })
  }
}

export const db = new ChetnaDB()

export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const SESSION_KEY = 'chetnadhara.parent'

export function currentParentId(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

export function setCurrentParentId(id: string | null) {
  if (id) localStorage.setItem(SESSION_KEY, id)
  else localStorage.removeItem(SESSION_KEY)
}
