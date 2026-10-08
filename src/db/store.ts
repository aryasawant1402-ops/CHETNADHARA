import { ageAllowed, ageYears } from '../engine/age.ts'
import {
  currentParentId,
  db,
  hashPin,
  setCurrentParentId,
  type ChildRecord,
  type CheckRecord,
  type ParentRecord,
  type PhotoRecord,
  type ReportRecord,
  type SessionRecord,
  type TaskResult,
} from './db.ts'

export async function listParents(): Promise<ParentRecord[]> {
  return db.parents.orderBy('createdAt').toArray()
}

export async function createParent(input: { name: string; email: string; pin: string }): Promise<ParentRecord> {
  const id = crypto.randomUUID()
  const parent: ParentRecord = {
    id,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    pinHash: await hashPin(input.pin, id),
    consentAt: null,
    createdAt: new Date().toISOString(),
  }
  await db.parents.add(parent)
  await db.settings.add({ id, limits: {} })
  setCurrentParentId(id)
  return parent
}

export async function unlockParent(id: string, pin: string): Promise<ParentRecord | null> {
  const parent = await db.parents.get(id)
  if (!parent) return null
  const hash = await hashPin(pin, id)
  if (hash !== parent.pinHash) return null
  setCurrentParentId(id)
  return parent
}

export async function currentParent(): Promise<ParentRecord | null> {
  const id = currentParentId()
  if (!id) return null
  return (await db.parents.get(id)) ?? null
}

export async function giveConsent(parentId: string): Promise<void> {
  await db.parents.update(parentId, { consentAt: new Date().toISOString() })
}

export async function changePin(parentId: string, current: string, next: string): Promise<boolean> {
  const parent = await db.parents.get(parentId)
  if (!parent) return false
  if ((await hashPin(current, parentId)) !== parent.pinHash) return false
  await db.parents.update(parentId, { pinHash: await hashPin(next, parentId) })
  return true
}

export function signOut() {
  setCurrentParentId(null)
}

export async function saveChild(child: ChildRecord): Promise<void> {
  await db.children.put(child)
}

export async function listChildren(parentId: string): Promise<ChildRecord[]> {
  return db.children.where('parentId').equals(parentId).sortBy('createdAt')
}

export async function getChild(id: string): Promise<ChildRecord | undefined> {
  return db.children.get(id)
}

export function validateChildAge(dob: string): { ok: true; age: number } | { ok: false; message: string } {
  const age = ageYears(dob)
  if (!ageAllowed(age)) {
    return { ok: false, message: 'ChetnaDhara checks are for children aged 5 to 13. Please check the date of birth.' }
  }
  return { ok: true, age }
}

export async function activeCheck(childId: string): Promise<CheckRecord | undefined> {
  const rows = await db.checks.where('childId').equals(childId).toArray()
  return rows.find((row) => row.status === 'active')
}

export async function saveCheck(check: CheckRecord): Promise<void> {
  await db.checks.put({ ...check, updatedAt: new Date().toISOString() })
}

export async function startCheck(childId: string): Promise<CheckRecord> {
  const existing = await activeCheck(childId)
  if (existing) return existing
  const check: CheckRecord = {
    id: crypto.randomUUID(),
    childId,
    status: 'active',
    gateOk: false,
    cursor: 0,
    results: [],
    updatedAt: new Date().toISOString(),
  }
  await db.checks.add(check)
  return check
}

export async function saveReport(report: ReportRecord): Promise<void> {
  await db.reports.add(report)
}

export async function listReports(childId: string): Promise<ReportRecord[]> {
  const rows = await db.reports.where('childId').equals(childId).toArray()
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getReport(id: string): Promise<ReportRecord | undefined> {
  return db.reports.get(id)
}

export async function saveSession(row: SessionRecord): Promise<void> {
  await db.sessions.add(row)
}

export async function listSessions(childId: string): Promise<SessionRecord[]> {
  const rows = await db.sessions.where('childId').equals(childId).toArray()
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function screenUsed(childId: string, day: string): Promise<number> {
  const row = await db.screenTime.get(`${childId}:${day}`)
  return row?.usedSeconds ?? 0
}

export async function setScreenUsed(childId: string, day: string, usedSeconds: number): Promise<void> {
  await db.screenTime.put({ id: `${childId}:${day}`, childId, day, usedSeconds })
}

export async function childLimit(parentId: string, childId: string, fallback: number): Promise<number> {
  const settings = await db.settings.get(parentId)
  const custom = settings?.limits[childId]
  return custom ?? fallback
}

export async function setChildLimit(parentId: string, childId: string, minutes: number): Promise<void> {
  const settings = (await db.settings.get(parentId)) ?? { id: parentId, limits: {} }
  settings.limits[childId] = minutes
  await db.settings.put(settings)
}

export async function savePhoto(photo: PhotoRecord): Promise<void> {
  await db.photos.add(photo)
}

export async function exportData(parentId: string) {
  const parent = await db.parents.get(parentId)
  const children = await listChildren(parentId)
  const childIds = new Set(children.map((child) => child.id))
  const reports = (await db.reports.toArray()).filter((row) => childIds.has(row.childId))
  const sessions = (await db.sessions.toArray()).filter((row) => childIds.has(row.childId))
  const checks = (await db.checks.toArray()).filter((row) => childIds.has(row.childId))
  return {
    exportedAt: new Date().toISOString(),
    notice: 'Demo export from this browser only.',
    parent: parent ? { ...parent, pinHash: '[redacted]' } : null,
    children,
    reports,
    sessions,
    checks,
  }
}

export async function deleteEverything(): Promise<void> {
  await db.delete()
  await db.open()
  setCurrentParentId(null)
  localStorage.removeItem('chetnadhara.a11y')
}

export function emptyChild(parentId: string): ChildRecord {
  return {
    id: crypto.randomUUID(),
    parentId,
    nickname: '',
    dob: '',
    grade: 'Grade 1',
    languagesHome: 'English',
    languagesSchool: 'English',
    vision: '',
    hearing: '',
    glasses: false,
    conditions: [],
    conditionsOther: '',
    medications: '',
    speechDelay: '',
    milestones: '',
    birthComplications: '',
    familyHistory: '',
    previousAssessments: '',
    teacherConcerns: '',
    visual: { spacing: 'cozy', overlay: 'cream' },
    createdAt: new Date().toISOString(),
  }
}

export type { TaskResult }
