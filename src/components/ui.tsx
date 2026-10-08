import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useA11y } from '../a11y/A11y.tsx'
import { DISCLAIMER } from '../copy.ts'
import { currentParent, unlockParent } from '../db/store.ts'

export function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.92
  window.speechSynthesis.speak(utterance)
}

export function ModeToggles() {
  const { prefs, update } = useA11y()
  const items = [
    ['dyslexia', 'Dyslexia font'],
    ['dark', 'Dark'],
    ['contrast', 'High contrast'],
    ['reducedMotion', 'Reduced motion'],
    ['lineFocus', 'Line focus'],
  ] as const
  return (
    <div className="toggles" role="group" aria-label="Accessibility">
      {items.map(([key, label]) => (
        <button key={key} type="button" className={prefs[key] ? 'chip on' : 'chip'} aria-pressed={prefs[key]} onClick={() => update({ [key]: !prefs[key] })}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function LineRuler() {
  const { prefs } = useA11y()
  const [y, setY] = useState(160)
  useEffect(() => {
    if (!prefs.lineFocus || !prefs.dyslexia) return
    const move = (event: PointerEvent) => setY(event.clientY)
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [prefs.lineFocus, prefs.dyslexia])
  if (!prefs.lineFocus || !prefs.dyslexia) return null
  return <div className="ruler" style={{ top: y - 18 }} />
}

export function Mascot({ age, name }: { age?: number; name?: string }) {
  const coach = (age ?? 8) >= 10
  return (
    <div className="mascot">
      <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
        <rect x="6" y="6" width="52" height="52" rx={coach ? 8 : 26} fill={coach ? '#1f3a4d' : '#e7b23a'} />
        <circle cx="24" cy="28" r="3" fill="#1c2430" />
        <circle cx="40" cy="28" r="3" fill="#1c2430" />
        <path d="M22 42c4 5 16 5 20 0" fill="none" stroke="#1c2430" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p>{coach ? 'Coach' : 'Chetna Buddy'}{name ? ` is here with ${name}.` : ' is here.'}</p>
    </div>
  )
}

export function Prose({ text }: { text: string }) {
  return (
    <div className="prose-block">
      <p>{text}</p>
      <button type="button" className="chip" onClick={() => speak(text)}>Listen</button>
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const child = location.pathname.startsWith('/child/')
  return (
    <>
      <LineRuler />
      <header className="top">
        <Link to="/" className="brand">ChetnaDhara</Link>
        <ModeToggles />
        <nav>
          {child ? <ParentJump /> : <Link to="/dashboard">Dashboard</Link>}
          <Link to="/settings">Settings</Link>
        </nav>
      </header>
      <main className="measure">{children}</main>
      <footer className="site-foot">Screening and support only. ChetnaDhara does not diagnose.</footer>
    </>
  )
}

function ParentJump() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  if (!open) return <button type="button" className="chip" onClick={() => setOpen(true)}>Parent home</button>
  return (
    <form
      className="inline-pin"
      onSubmit={(event) => {
        event.preventDefault()
        void (async () => {
          const parent = await currentParent()
          if (!parent) return
          const ok = await unlockParent(parent.id, pin)
          if (!ok) {
            setMessage('That PIN did not match.')
            return
          }
          navigate('/dashboard')
        })()
      }}
    >
      <input aria-label="Parent PIN" inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} />
      <button className="chip" type="submit">Go</button>
      {message ? <span>{message}</span> : null}
    </form>
  )
}

export function Disclaimer() {
  return <p className="disclaimer">{DISCLAIMER}</p>
}

export function RiskBadge({ risk }: { risk: string }) {
  return <p className={`badge risk-${risk}`}>{risk === 'unclear' ? 'Unclear — please retake' : `${risk} screening risk`}</p>
}
