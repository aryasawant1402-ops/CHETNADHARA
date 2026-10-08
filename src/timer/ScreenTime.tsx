import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CHILD_LOCK, PARENT_LOCK, WHO_NOTE } from '../copy.ts'
import { childLimit, currentParent, getChild, listReports, screenUsed, setChildLimit, setScreenUsed, unlockParent } from '../db/store.ts'
import { offlineFor } from '../content/session.ts'
import { ageYears, defaultLimitMinutes } from '../engine/age.ts'
import { formatClock, localDay, remainingSeconds, shouldChime } from './time.ts'

interface TimerValue {
  childId: string | null
  remaining: number | null
  limitMinutes: number
  locked: boolean
  registerSave: (fn: () => Promise<void>) => void
}

const TimerContext = createContext<TimerValue | null>(null)

function chime() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return
  const audio = new Ctx()
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = 'sine'
  osc.frequency.value = 523
  gain.gain.setValueAtTime(0.0001, audio.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.04, audio.currentTime + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.45)
  osc.connect(gain)
  gain.connect(audio.destination)
  osc.start()
  osc.stop(audio.currentTime + 0.5)
  osc.onended = () => void audio.close()
}

export function ScreenTimeProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const childId = location.pathname.match(/^\/child\/([^/]+)\//)?.[1]
  const active = /^\/child\/[^/]+\/(check|plan|play)/.test(location.pathname)
  const [used, setUsed] = useState(0)
  const [limitMinutes, setLimitMinutes] = useState(45)
  const [ready, setReady] = useState(false)
  const [offline, setOffline] = useState<string[]>([])
  const [warn, setWarn] = useState(false)
  const limitRef = useRef(limitMinutes)
  const usedRef = useRef(0)
  const saveRef = useRef<() => Promise<void>>(async () => {})
  const childRef = useRef(childId)
  limitRef.current = limitMinutes
  usedRef.current = used
  childRef.current = childId
  const registerSave = useCallback((fn: () => Promise<void>) => {
    saveRef.current = fn
  }, [])

  useEffect(() => {
    if (!childId || !active) {
      setReady(false)
      return
    }
    let cancel = false
    const day = localDay()
    void (async () => {
      const child = await getChild(childId)
      const parent = await currentParent()
      const age = child ? ageYears(child.dob) ?? 8 : 8
      const fallback = defaultLimitMinutes(age)
      const limit = parent ? await childLimit(parent.id, childId, fallback) : fallback
      const seconds = await screenUsed(childId, day)
      if (cancel) return
      setLimitMinutes(limit)
      setUsed(seconds)
      const reports = await listReports(childId)
      const latest = reports.at(-1)
      const profile = latest && latest.score.risk !== 'unclear' ? latest.score.profile : 'phonological'
      const severity = latest?.score.severity ?? 'mild'
      setOffline(offlineFor(profile, age, severity))
      setReady(true)
      setWarn(remainingSeconds(seconds, limit) <= 300 && remainingSeconds(seconds, limit) > 0)
    })()
    return () => {
      cancel = true
    }
  }, [childId, active])

  useEffect(() => {
    if (!ready || !childId || !active) return
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setUsed((current) => {
        const limit = limitRef.current
        if (current >= limit * 60) return current
        const next = current + 1
        const before = remainingSeconds(current, limit)
        const after = remainingSeconds(next, limit)
        if (shouldChime(before, after)) {
          chime()
          setWarn(true)
        }
        if (after === 0) {
          void setScreenUsed(childRef.current!, localDay(), next)
          void saveRef.current()
        } else if (next % 5 === 0) {
          void setScreenUsed(childRef.current!, localDay(), next)
        }
        return next
      })
    }, 1000)
    const onHide = () => {
      if (childRef.current) void setScreenUsed(childRef.current, localDay(), usedRef.current)
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onHide)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('beforeunload', onHide)
    }
  }, [ready, childId, active])

  const remaining = active && ready ? remainingSeconds(used, limitMinutes) : null
  const locked = remaining === 0
  const value = useMemo<TimerValue>(() => ({
    childId: childId ?? null,
    remaining,
    limitMinutes,
    locked,
    registerSave,
  }), [childId, remaining, limitMinutes, locked, registerSave])

  return (
    <TimerContext.Provider value={value}>
      {active && remaining !== null ? <TimerBar remaining={remaining} warn={warn && remaining > 0} /> : null}
      {children}
      {locked ? <LockModal offline={offline} /> : null}
    </TimerContext.Provider>
  )
}

function TimerBar({ remaining, warn }: { remaining: number; warn: boolean }) {
  return (
    <div className="timer-bar" role="timer" aria-live="polite">
      <span>Screen time left {formatClock(remaining)}</span>
      {warn ? <span>Five minutes left. A soft chime means it is time to wind down.</span> : null}
    </div>
  )
}

function LockModal({ offline }: { offline: string[] }) {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  return (
    <div className="lock" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <div className="card lock-card">
        <h2 id="lock-title">{CHILD_LOCK}</h2>
        <p>{PARENT_LOCK}</p>
        <ol>
          {offline.map((line) => <li key={line}>{line}</li>)}
        </ol>
        <p className="hint">{WHO_NOTE}</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void (async () => {
              const parent = await currentParent()
              if (!parent) return
              const ok = await unlockParent(parent.id, pin)
              if (!ok) {
                setMessage('That PIN did not match.')
                setPin('')
                return
              }
              navigate('/settings')
            })()
          }}
        >
          <label>
            Parent PIN to open settings
            <input inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} />
          </label>
          <button className="btn" type="submit">Open settings</button>
          {message ? <p>{message}</p> : null}
        </form>
      </div>
    </div>
  )
}

export function useScreenTime() {
  const context = useContext(TimerContext)
  if (!context) throw new Error('ScreenTimeProvider missing')
  return context
}

export function useSaveOnLock(save: () => Promise<void>) {
  const { registerSave } = useScreenTime()
  const ref = useRef(save)
  ref.current = save
  useEffect(() => {
    registerSave(() => ref.current())
    return () => registerSave(async () => {})
  }, [registerSave])
}

export async function updateLimit(parentId: string, childId: string, minutes: number) {
  const clamped = Math.min(120, Math.max(1, Math.round(minutes)))
  await setChildLimit(parentId, childId, clamped)
}
