import { describe, expect, it } from 'vitest'
import { ageAllowed, ageYears } from './age.ts'
import { scoreScreening, type NormTable, type TaskSignal, type WeightConfig } from './score.ts'
import { shouldChime } from '../timer/time.ts'
import norms from './norms.demo.json' with { type: 'json' }
import weightsFile from './weights.json' with { type: 'json' }
import activities from '../content/activities.json' with { type: 'json' }

const weights = weightsFile as WeightConfig

function table(): NormTable {
  const cell = { mean: 80, sd: 10, higherIsBetter: true }
  const ids = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T12']
  const band: NormTable['bands'][string] = { Q: { mean: 4, sd: 2, higherIsBetter: false } }
  for (const id of ids) band[id] = { ...cell }
  return { demo: true, notice: 'Demo norms — replace after clinical calibration.', bands: { '7-8': band } }
}

function tasks(overrides: Record<string, number> = {}, unreliable: string[] = []): TaskSignal[] {
  const ids = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T12', 'Q']
  return ids.map((taskId) => ({
    taskId,
    raw: overrides[taskId] ?? (taskId === 'Q' ? 4 : 80),
    reliable: !unreliable.includes(taskId),
  }))
}

function run(overrides: Record<string, number> = {}, unreliable: string[] = []) {
  return scoreScreening({ age: 8, tasks: tasks(overrides, unreliable), norms: table(), weights })
}

describe('scoring engine', () => {
  it('marks an even profile as low risk with no clear pattern', () => {
    const report = run()
    expect(report.risk).toBe('low')
    expect(report.profile).toBe('no-clear-pattern')
    expect(report.severity).toBe('mild')
    expect(report.disclaimer.toLowerCase()).not.toContain('has dyslexia')
  })

  it('marks two flagged dimensions as medium', () => {
    const report = run({ T1: 70, T2: 70, T3: 70, T8: 70 })
    expect(report.risk).toBe('medium')
    expect(report.dimensions.find((dim) => dim.id === 'phonological')?.flag).toBe('flagged')
    expect(report.dimensions.find((dim) => dim.id === 'workingMemory')?.flag).toBe('flagged')
  })

  it('marks four flags as high', () => {
    const report = run({ T1: 70, T2: 70, T3: 70, T5: 70, T6: 70, T7: 70, T8: 70 })
    expect(report.risk).toBe('high')
  })

  it('marks two strong flags as high', () => {
    const report = run({ T4: 65, T5: 65 })
    expect(report.risk).toBe('high')
    expect(report.dimensions.find((dim) => dim.id === 'decoding')?.flag).toBe('strong')
  })

  it('returns unclear when too many signals are unreliable', () => {
    const report = run({}, ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'])
    expect(report.risk).toBe('unclear')
    expect(report.profile).toBe('no-clear-pattern')
    expect(report.explanation.toLowerCase()).toContain('retake')
  })

  it('names a phonological tendency', () => {
    const report = run({ T1: 70, T2: 70, T3: 70, T4: 70 })
    expect(report.profile).toBe('phonological')
  })

  it('names a surface tendency when decoding is decent', () => {
    const report = run({ T6: 70, T7: 70, T8: 70 })
    expect(report.profile).toBe('surface-orthographic')
    expect(report.risk).toBe('medium')
  })

  it('names a rapid-naming tendency', () => {
    const report = run({ T5: 70 })
    expect(report.profile).toBe('rapid-naming')
    expect(report.risk).toBe('low')
  })

  it('names a double-deficit tendency', () => {
    const report = run({ T1: 70, T2: 70, T3: 70, T5: 70 })
    expect(report.profile).toBe('double-deficit')
  })

  it('names a mixed tendency', () => {
    const report = run({ T5: 70, T6: 70, T7: 70 })
    expect(report.profile).toBe('mixed')
  })

  it('adds an attention note without turning a strong literacy profile into the only story', () => {
    const report = run({ T9: 60 })
    expect(report.risk).toBe('low')
    expect(report.notes.join(' ').toLowerCase()).toContain('attention')
  })

  it('adds a reasoning note when the control task is very low', () => {
    const report = run({ T1: 70, T2: 70, T3: 70, T12: 60 })
    expect(report.notes.join(' ').toLowerCase()).toContain('reasoning')
  })

  it('does not flag a z just above -1', () => {
    const report = run({ T5: 70.2 })
    expect(report.dimensions.find((dim) => dim.id === 'naming')?.flag).toBe('none')
  })

  it('ships demo norms and a full activity matrix', () => {
    expect(norms.demo).toBe(true)
    expect(norms.notice).toContain('Demo norms')
    expect(weights.phonological).toBe(0.25)
    for (const profile of Object.values(activities.matrix)) {
      for (const band of Object.values(profile)) {
        for (const ids of Object.values(band)) {
          expect(ids.length).toBeGreaterThanOrEqual(3)
          for (const id of ids) {
            expect(activities.activities.some((item) => item.id === id)).toBe(true)
          }
        }
      }
    }
  })
})

describe('age gate and timer warning', () => {
  const today = new Date(2026, 9, 8)

  it('rejects ages outside 5 to 13', () => {
    expect(ageAllowed(ageYears('2021-10-09', today))).toBe(false)
    expect(ageYears('2021-10-08', today)).toBe(5)
    expect(ageYears('2013-10-08', today)).toBe(13)
    expect(ageAllowed(ageYears('2012-10-08', today))).toBe(false)
  })

  it('chimes only when crossing the five-minute mark', () => {
    expect(shouldChime(301, 300)).toBe(true)
    expect(shouldChime(300, 299)).toBe(false)
  })
})
