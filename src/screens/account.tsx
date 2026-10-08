import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { DEMO_AUTH, PRIVACY, WHO_NOTE } from '../copy.ts'
import {
  changePin,
  createParent,
  currentParent,
  deleteEverything,
  emptyChild,
  exportData,
  getChild,
  giveConsent,
  listChildren,
  listParents,
  saveChild,
  signOut,
  unlockParent,
  validateChildAge,
  childLimit,
  setChildLimit,
} from '../db/store.ts'
import type { ChildRecord, ParentRecord } from '../db/db.ts'
import { ageYears, defaultLimitMinutes } from '../engine/age.ts'
import { Mascot, Prose, Shell } from '../components/ui.tsx'

export function LandingPage() {
  return (
    <Shell>
      <Mascot />
      <h1>ChetnaDhara</h1>
      <Prose text="Awareness, then a daily flow. ChetnaDhara helps you notice reading-skill risk for a child aged 5 to 13, see a skill profile, and practise with short games and stories." />
      <p>This is a screening and support website. It does not diagnose a reading condition.</p>
      <div className="choices">
        <Link className="btn" to="/create">Create parent account</Link>
        <Link className="btn ghost" to="/login">Demo sign-in</Link>
      </div>
    </Shell>
  )
}

export function CreatePage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  return (
    <Shell>
      <h1>Create a parent account</h1>
      <p className="banner">{DEMO_AUTH}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const pin = String(data.get('pin') ?? '')
          const again = String(data.get('again') ?? '')
          if (!/^\d{4}$/.test(pin) || pin !== again) {
            setError('Use the same 4-digit PIN twice.')
            return
          }
          void createParent({ name: String(data.get('name') ?? ''), email: String(data.get('email') ?? ''), pin }).then(() => navigate('/consent'))
        }}
      >
        <label>Your name<input name="name" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>4-digit PIN<input name="pin" inputMode="numeric" minLength={4} maxLength={4} required /></label>
        <label>Repeat PIN<input name="again" inputMode="numeric" minLength={4} maxLength={4} required /></label>
        {error ? <p>{error}</p> : null}
        <button className="btn" type="submit">Continue to consent</button>
      </form>
    </Shell>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const [parents, setParents] = useState<ParentRecord[]>([])
  const [error, setError] = useState('')
  useEffect(() => { void listParents().then(setParents) }, [])
  return (
    <Shell>
      <h1>Demo sign-in</h1>
      <p className="banner">{DEMO_AUTH}</p>
      {parents.length === 0 ? <p>No account on this browser yet.</p> : null}
      {parents.map((parent) => (
        <form
          key={parent.id}
          onSubmit={(event) => {
            event.preventDefault()
            const pin = String(new FormData(event.currentTarget).get('pin') ?? '')
            void unlockParent(parent.id, pin).then((row) => {
              if (!row) {
                setError('That PIN did not match.')
                return
              }
              navigate(row.consentAt ? '/children' : '/consent')
            })
          }}
        >
          <p>{parent.name}</p>
          <label>PIN<input name="pin" inputMode="numeric" maxLength={4} required /></label>
          <button className="btn" type="submit">Enter</button>
        </form>
      ))}
      {error ? <p>{error}</p> : null}
      <Link to="/create">Create an account</Link>
    </Shell>
  )
}

export function ConsentPage() {
  const navigate = useNavigate()
  const [parent, setParent] = useState<ParentRecord | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => { void currentParent().then(setParent) }, [])
  if (parent === null) return <Shell><p>Loading…</p></Shell>
  if (!parent) return <Navigate to="/login" />
  return (
    <Shell>
      <h1>Parent consent</h1>
      <Prose text="ChetnaDhara stores your child’s nickname, age, screening answers, and optional health notes in this browser only." />
      <button className="chip" type="button" onClick={() => setOpen(true)}>Read the privacy notice</button>
      {open ? <p className="card">{PRIVACY} You can delete everything from this screen or from Settings.</p> : null}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void giveConsent(parent.id).then(() => navigate('/children'))
        }}
      >
        <label className="check">
          <input type="checkbox" required /> I am the parent or legal guardian and I consent to storing my child’s screening answers on this device.
        </label>
        <button className="btn" type="submit">I consent</button>
      </form>
      <button className="btn ghost" type="button" onClick={() => void deleteEverything()}>Delete all data on this device</button>
    </Shell>
  )
}

export function ChildrenPage() {
  const [parent, setParent] = useState<ParentRecord | null>(null)
  const [children, setChildren] = useState<ChildRecord[]>([])
  useEffect(() => {
    void currentParent().then(async (row) => {
      setParent(row)
      if (row) setChildren(await listChildren(row.id))
    })
  }, [])
  if (parent === null) return <Shell><p>Loading…</p></Shell>
  if (!parent) return <Navigate to="/login" />
  if (!parent.consentAt) return <Navigate to="/consent" />
  return (
    <Shell>
      <h1>Children</h1>
      <p>Each child has a separate check, plan, and screen-time budget. Nothing here ranks one child against another.</p>
      <ul className="stack">
        {children.map((child) => (
          <li key={child.id} className="card">
            <Mascot age={ageYears(child.dob) ?? 8} name={child.nickname} />
            <h2>{child.nickname}</h2>
            <p>Age {ageYears(child.dob)}</p>
            <div className="choices">
              <Link className="btn" to={`/child/${child.id}/check`}>ChetnaDhara Check</Link>
              <Link className="btn ghost" to={`/child/${child.id}/plan`}>Daily plan</Link>
              <Link className="btn ghost" to={`/dashboard/${child.id}`}>Dashboard</Link>
            </div>
          </li>
        ))}
      </ul>
      <Link className="btn" to="/children/new">Add a child</Link>
    </Shell>
  )
}

export function ChildFormPage() {
  const navigate = useNavigate()
  const [parent, setParent] = useState<ParentRecord | null>(null)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<ChildRecord | null>(null)
  useEffect(() => {
    void currentParent().then((row) => {
      setParent(row)
      if (row) setDraft(emptyChild(row.id))
    })
  }, [])
  if (!draft || !parent) return <Shell><p>Loading…</p></Shell>
  const today = new Date()
  const min = shiftYears(today, -13)
  const max = shiftYears(today, -5)
  return (
    <Shell>
      <h1>Child profile</h1>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          const age = validateChildAge(draft.dob)
          if (!age.ok) {
            setError(age.message)
            return
          }
          if (!draft.nickname.trim()) {
            setError('Add a nickname.')
            return
          }
          void saveChild(draft).then(() => navigate('/children'))
        }}
      >
        <label>Nickname<input value={draft.nickname} required onChange={(event) => setDraft({ ...draft, nickname: event.target.value })} /></label>
        <label>Date of birth<input type="date" min={min} max={max} value={draft.dob} required onChange={(event) => setDraft({ ...draft, dob: event.target.value })} /></label>
        {error ? <p role="alert">{error}</p> : null}
        <label>School grade
          <select value={draft.grade} onChange={(event) => setDraft({ ...draft, grade: event.target.value })}>
            {['Not in school', 'Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'].map((grade) => <option key={grade}>{grade}</option>)}
          </select>
        </label>
        <label>Languages at home<input value={draft.languagesHome} onChange={(event) => setDraft({ ...draft, languagesHome: event.target.value })} /></label>
        <label>Languages at school<input value={draft.languagesSchool} onChange={(event) => setDraft({ ...draft, languagesSchool: event.target.value })} /></label>
        <fieldset>
          <legend>Optional health notes</legend>
          <p>{PRIVACY}</p>
          <label>Vision<input value={draft.vision} onChange={(event) => setDraft({ ...draft, vision: event.target.value })} /></label>
          <label>Hearing<input value={draft.hearing} onChange={(event) => setDraft({ ...draft, hearing: event.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={draft.glasses} onChange={(event) => setDraft({ ...draft, glasses: event.target.checked })} /> Wears glasses</label>
          <p>Diagnosed conditions</p>
          {['ADHD', 'Autism', 'Other'].map((item) => (
            <label key={item} className="check">
              <input
                type="checkbox"
                checked={draft.conditions.includes(item)}
                onChange={(event) => {
                  const conditions = event.target.checked ? [...draft.conditions, item] : draft.conditions.filter((value) => value !== item)
                  setDraft({ ...draft, conditions })
                }}
              /> {item}
            </label>
          ))}
          <label>Other condition<input value={draft.conditionsOther} onChange={(event) => setDraft({ ...draft, conditionsOther: event.target.value })} /></label>
          <label>Medications<input value={draft.medications} onChange={(event) => setDraft({ ...draft, medications: event.target.value })} /></label>
          <label>Early speech or language delay<input value={draft.speechDelay} onChange={(event) => setDraft({ ...draft, speechDelay: event.target.value })} /></label>
          <label>Developmental milestones<input value={draft.milestones} onChange={(event) => setDraft({ ...draft, milestones: event.target.value })} /></label>
          <label>Birth complications<input value={draft.birthComplications} onChange={(event) => setDraft({ ...draft, birthComplications: event.target.value })} /></label>
          <label>Family history of dyslexia or learning difficulty<input value={draft.familyHistory} onChange={(event) => setDraft({ ...draft, familyHistory: event.target.value })} /></label>
          <label>Previous assessments<input value={draft.previousAssessments} onChange={(event) => setDraft({ ...draft, previousAssessments: event.target.value })} /></label>
          <label>Teacher concerns<input value={draft.teacherConcerns} onChange={(event) => setDraft({ ...draft, teacherConcerns: event.target.value })} /></label>
        </fieldset>
        <button className="btn" type="submit">Save profile</button>
      </form>
    </Shell>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { childId } = useParams()
  const [parent, setParent] = useState<ParentRecord | null>(null)
  const [children, setChildren] = useState<ChildRecord[]>([])
  const [limits, setLimits] = useState<Record<string, number>>({})
  const [message, setMessage] = useState('')
  useEffect(() => {
    void currentParent().then(async (row) => {
      setParent(row)
      if (!row) return
      const list = await listChildren(row.id)
      setChildren(list)
      const next: Record<string, number> = {}
      for (const child of list) {
        const age = ageYears(child.dob) ?? 8
        next[child.id] = await childLimit(row.id, child.id, defaultLimitMinutes(age))
      }
      setLimits(next)
    })
  }, [])
  if (parent === null) return <Shell><p>Loading…</p></Shell>
  if (!parent) return <Navigate to="/login" />
  return (
    <Shell>
      <h1>Settings</h1>
      <p className="banner">{DEMO_AUTH} Language: English only.</p>
      <p>{WHO_NOTE}</p>
      {children.map((child) => (
        <label key={child.id}>Screen time for {child.nickname} (minutes, max 120)
          <input
            type="number"
            min={1}
            max={120}
            value={limits[child.id] ?? 30}
            onChange={(event) => setLimits({ ...limits, [child.id]: Number(event.target.value) })}
          />
          <button className="btn" type="button" onClick={() => void setChildLimit(parent.id, child.id, Math.min(120, Math.max(1, limits[child.id] ?? 30))).then(() => setMessage('Limit saved.'))}>Save limit with your signed-in PIN session</button>
        </label>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          void changePin(parent.id, String(data.get('old') ?? ''), String(data.get('next') ?? '')).then((ok) => setMessage(ok ? 'PIN updated.' : 'Current PIN did not match.'))
        }}
      >
        <h2>Change PIN</h2>
        <label>Current PIN<input name="old" inputMode="numeric" maxLength={4} required /></label>
        <label>New PIN<input name="next" inputMode="numeric" maxLength={4} required /></label>
        <button className="btn" type="submit">Update PIN</button>
      </form>
      {message ? <p>{message}</p> : null}
      <button className="btn ghost" type="button" onClick={() => void exportData(parent.id).then((data) => downloadJson(data))}>Export data</button>
      <button className="btn ghost" type="button" onClick={() => {
        const typed = window.prompt('Type DELETE to remove every ChetnaDhara record on this device.')
        if (typed === 'DELETE') void deleteEverything()
      }}>Delete all data</button>
      <button className="chip" type="button" onClick={() => { signOut(); navigate('/login') }}>Sign out</button>
      {childId ? <p className="hint">Opened from a child screen.</p> : null}
    </Shell>
  )
}

function shiftYears(date: Date, years: number): string {
  const copy = new Date(date)
  copy.setFullYear(copy.getFullYear() + years)
  const month = String(copy.getMonth() + 1).padStart(2, '0')
  const day = String(copy.getDate()).padStart(2, '0')
  return `${copy.getFullYear()}-${month}-${day}`
}

function downloadJson(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'chetnadhara-export.json'
  link.click()
  URL.revokeObjectURL(url)
}

export function useChild(childId: string | undefined) {
  const [child, setChild] = useState<ChildRecord | null>(null)
  useEffect(() => {
    if (!childId) return
    void getChild(childId).then((row) => {
      setChild(row ?? null)
      if (row) {
        document.documentElement.dataset.spacing = row.visual.spacing
        document.documentElement.dataset.overlay = row.visual.overlay
      }
    })
  }, [childId])
  return child
}
