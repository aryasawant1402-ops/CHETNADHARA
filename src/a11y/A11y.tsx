import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface A11yPrefs {
  dyslexia: boolean
  dark: boolean
  contrast: boolean
  reducedMotion: boolean
  lineFocus: boolean
}

const KEY = 'chetnadhara.a11y'
const DEFAULTS: A11yPrefs = { dyslexia: false, dark: false, contrast: false, reducedMotion: false, lineFocus: false }

function load(): A11yPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

const A11yContext = createContext<{ prefs: A11yPrefs; update: (patch: Partial<A11yPrefs>) => void } | null>(null)

export function A11yProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<A11yPrefs>(load)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.dyslexia = prefs.dyslexia ? 'on' : 'off'
    root.dataset.theme = prefs.dark ? 'dark' : 'light'
    root.dataset.contrast = prefs.contrast ? 'high' : 'normal'
    root.dataset.motion = prefs.reducedMotion ? 'reduce' : 'full'
    root.dataset.ruler = prefs.lineFocus ? 'on' : 'off'
    localStorage.setItem(KEY, JSON.stringify(prefs))
  }, [prefs])

  const value = useMemo(() => ({ prefs, update: (patch: Partial<A11yPrefs>) => setPrefs((current) => ({ ...current, ...patch })) }), [prefs])
  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>
}

export function useA11y() {
  const context = useContext(A11yContext)
  if (!context) throw new Error('A11yProvider missing')
  return context
}
