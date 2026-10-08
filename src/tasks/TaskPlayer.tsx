import { useEffect, useMemo, useRef, useState } from 'react'
import { distractors, fetchRhymes } from '../content/remote.ts'
import type { ChildRecord, TaskResult } from '../db/db.ts'
import { saveChild, savePhoto } from '../db/store.ts'
import { speak } from '../components/ui.tsx'

interface Props {
  taskId: string
  age: number
  child: ChildRecord
  onComplete: (result: TaskResult) => void
}

interface Round {
  prompt: string
  options: string[]
  answer: string
  speak?: string
}

function shuffle(values: string[]): string[] {
  return [...values].sort(() => Math.random() - 0.5)
}

function Quiz({ title, intro, rounds, onComplete, taskId }: { title: string; intro: string; rounds: Round[]; taskId: string; onComplete: (result: TaskResult) => void }) {
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [note, setNote] = useState('')
  const [locked, setLocked] = useState(false)
  const round = rounds[index]
  if (!round) {
    return (
      <section>
        <h2>Nice work</h2>
        <p>You finished {title}.</p>
        <button className="btn" type="button" onClick={() => onComplete({ taskId, raw: Math.round((correct / rounds.length) * 100), reliable: true, metrics: { correct, total: rounds.length } })}>Save and continue</button>
      </section>
    )
  }
  return (
    <section>
      <h2>{title}</h2>
      <p>{intro}</p>
      <p className="hint">Item {index + 1} of {rounds.length}</p>
      <p className="prompt">{round.prompt}</p>
      {round.speak ? <button className="chip" type="button" onClick={() => speak(round.speak!)}>Listen</button> : null}
      <div className="choices">
        {round.options.map((option) => (
          <button
            key={option}
            className="btn ghost"
            type="button"
            onClick={() => {
              if (locked) return
              setLocked(true)
              const hit = option === round.answer
              if (hit) setCorrect((value) => value + 1)
              setNote(hit ? 'Yes, that matches.' : `Good try. A matching answer is “${round.answer}”.`)
              window.setTimeout(() => {
                setNote('')
                setLocked(false)
                setIndex((value) => value + 1)
              }, 700)
            }}
          >
            {option}
          </button>
        ))}
      </div>
      {note ? <p className="note">{note}</p> : null}
    </section>
  )
}

export function TaskPlayer({ taskId, age, child, onComplete }: Props) {
  if (taskId === 'T1') return <MemoQuiz source="T1" age={age} taskId="T1" title="Letter sounds" intro={`${child.nickname}, which sound matches?`} onComplete={onComplete} />
  if (taskId === 'T2') return <RhymeTask age={age} name={child.nickname} onComplete={onComplete} />
  if (taskId === 'T3') return <MemoQuiz source="T3" age={age} taskId="T3" title="Push the sounds together" intro="Listen, then pick the word." onComplete={onComplete} />
  if (taskId === 'T6') return <MemoQuiz source="T6" age={age} taskId="T6" title="Tricky words" intro="Look at the word, then find it again." onComplete={onComplete} />
  if (taskId === 'T7') return <SpellingTask age={age} onComplete={onComplete} />
  if (taskId === 'T8') return <MemoryTask age={age} onComplete={onComplete} />
  if (taskId === 'T9') return <AttentionTask onComplete={onComplete} />
  if (taskId === 'T11') return <HandTask childId={child.id} onComplete={onComplete} />
  if (taskId === 'T12') return <MemoQuiz source="T12" age={age} taskId="T12" title="Puzzle" intro="Which shape comes next? This is a thinking check, not a reading check." onComplete={onComplete} />
  if (taskId === 'T13') return <VisualTask child={child} onComplete={onComplete} />
  return <QuestionTask child={child} onComplete={onComplete} />
}

function MemoQuiz({ source, age, title, intro, taskId, onComplete }: { source: 'T1' | 'T3' | 'T6' | 'T12'; age: number; title: string; intro: string; taskId: string; onComplete: (result: TaskResult) => void }) {
  const rounds = useMemo(() => {
    if (source === 'T1') return letterRounds(age)
    if (source === 'T3') return blendRounds(age)
    if (source === 'T6') return sightRounds(age)
    return puzzleRounds()
  }, [source, age])
  return <Quiz title={title} intro={intro} taskId={taskId} rounds={rounds} onComplete={onComplete} />
}

function letterRounds(age: number): Round[] {
  const early: Round[] = [
    { prompt: 'Letter s', options: shuffle(['sss', 'mmm', 'fff']), answer: 'sss', speak: 's' },
    { prompt: 'Letter a', options: shuffle(['aaa', 'ooo', 'eee']), answer: 'aaa', speak: 'a' },
    { prompt: 'Letter t', options: shuffle(['ttt', 'sss', 'ppp']), answer: 'ttt', speak: 't' },
    { prompt: 'Letter m', options: shuffle(['mmm', 'nnn', 'lll']), answer: 'mmm', speak: 'm' },
  ]
  const later: Round[] = [
    { prompt: 'Letters ch', options: shuffle(['ch as in chip', 'sh as in ship', 'th as in thin']), answer: 'ch as in chip' },
    { prompt: 'Letters sh', options: shuffle(['sh as in ship', 'ch as in chip', 'th as in this']), answer: 'sh as in ship' },
    { prompt: 'Letters ee', options: shuffle(['ee as in tree', 'oa as in boat', 'ai as in rain']), answer: 'ee as in tree' },
  ]
  return age <= 6 ? early : later
}

function blendRounds(age: number): Round[] {
  const early = [
    { prompt: 'c · a · t', answer: 'cat', options: ['cat', 'cap', 'mat'] },
    { prompt: 's · u · n', answer: 'sun', options: ['sun', 'sit', 'run'] },
    { prompt: 'm · a · p', answer: 'map', options: ['map', 'man', 'tap'] },
  ]
  const later = [
    { prompt: 's · t · o · p', answer: 'stop', options: ['stop', 'step', 'spot'] },
    { prompt: 'b · l · a · ck', answer: 'black', options: ['black', 'block', 'back'] },
    { prompt: 's · p · or · t', answer: 'sport', options: ['sport', 'spot', 'port'] },
  ]
  return (age < 8 ? early : later).map((item) => ({ ...item, options: shuffle(item.options), speak: item.prompt }))
}

function sightRounds(age: number): Round[] {
  const bank = age < 9
    ? [['said', 'sad', 'sand'], ['was', 'saw', 'as'], ['they', 'then', 'the']]
    : age < 12
      ? [['because', 'becaus', 'becose'], ['friend', 'frend', 'freind'], ['once', 'ones', 'wunce']]
      : [['island', 'iland', 'ysland'], ['yacht', 'yatch', 'yaht'], ['rhythm', 'rythm', 'rhythym']]
  return bank.map(([answer, ...rest]) => ({ prompt: `Find ${answer}`, options: shuffle([answer, ...rest]), answer, speak: answer }))
}

function puzzleRounds(): Round[] {
  return [
    { prompt: 'Circle, circle, square, circle, circle, ___', options: shuffle(['square', 'circle', 'triangle']), answer: 'square' },
    { prompt: 'One dot, two dots, three dots, ___', options: shuffle(['four dots', 'one dot', 'six dots']), answer: 'four dots' },
    { prompt: 'Big, small, big, small, ___', options: shuffle(['big', 'small', 'tiny']), answer: 'big' },
  ]
}

function RhymeTask({ age, name, onComplete }: { age: number; name: string; onComplete: (result: TaskResult) => void }) {
  const seeds = age < 8 ? ['cat', 'sun', 'play'] : ['light', 'train', 'friend']
  const [rounds, setRounds] = useState<Round[] | null>(null)
  useEffect(() => {
    void (async () => {
      const built: Round[] = [
        { prompt: 'Which word starts with the same sound as sun?', options: shuffle(['sand', 'moon', 'tree']), answer: 'sand' },
      ]
      for (const seed of seeds) {
        const { words } = await fetchRhymes(seed)
        const answer = words[0] ?? 'hat'
        built.push({ prompt: `Which word rhymes with ${seed}?`, options: shuffle([answer, ...distractors(answer, words)]), answer, speak: seed })
      }
      setRounds(built)
    })()
  }, [age])
  if (!rounds) return <p>Finding rhymes…</p>
  return <Quiz taskId="T2" title="Rhyme and first sound" intro={`${name}, pick the sound that fits.`} rounds={rounds} onComplete={onComplete} />
}

function SpellingTask({ age, onComplete }: { age: number; onComplete: (result: TaskResult) => void }) {
  const rounds = useMemo(() => sightRounds(age).slice(0, 2), [age])
  const [phase, setPhase] = useState<'quiz' | 'type'>('quiz')
  const [quizScore, setQuizScore] = useState(0)
  const [typed, setTyped] = useState('')
  if (phase === 'quiz') {
    return (
      <Quiz
        taskId="T7"
        title="Choose the spelling"
        intro="Listen, then choose."
        rounds={rounds}
        onComplete={(result) => {
          setQuizScore(result.raw)
          setPhase('type')
        }}
      />
    )
  }
  const target = age < 11 ? 'ship' : 'helpful'
  const hit = typed.trim().toLowerCase() === target
  return (
    <section>
      <h2>Write the word</h2>
      <button className="chip" type="button" onClick={() => speak(target)}>Listen to the word</button>
      <input aria-label="Type the spelling" value={typed} onChange={(event) => setTyped(event.target.value)} />
      <button
        className="btn"
        type="button"
        onClick={() => onComplete({ taskId: 'T7', raw: Math.round((quizScore + (hit ? 100 : 40)) / 2), reliable: true, metrics: { quiz: quizScore, typed: hit ? 1 : 0 } })}
      >
        Save and continue
      </button>
      <p className="hint">Any try counts. We keep the practice kind.</p>
    </section>
  )
}

function MemoryTask({ age, onComplete }: { age: number; onComplete: (result: TaskResult) => void }) {
  const sequences = age < 8 ? ['27', '481'] : ['27', '481', '3056']
  const [index, setIndex] = useState(0)
  const [show, setShow] = useState(true)
  const [typed, setTyped] = useState('')
  const [hits, setHits] = useState(0)
  const sequence = sequences[index]
  useEffect(() => {
    if (!sequence) return
    setShow(true)
    const id = window.setTimeout(() => setShow(false), 1000 * sequence.length)
    return () => window.clearTimeout(id)
  }, [sequence])
  if (!sequence) {
    return (
      <section>
        <h2>Non-word</h2>
        <button className="chip" type="button" onClick={() => speak('baf')}>Listen</button>
        <div className="choices">
          {['baf', 'bim'].map((option) => (
            <button key={option} className="btn ghost" type="button" onClick={() => {
              const nonword = option === 'baf' ? 1 : 0
              const raw = Math.round(((hits / sequences.length) * 100 + nonword * 100) / 2)
              onComplete({ taskId: 'T8', raw, reliable: true, metrics: { spans: hits, nonword } })
            }}>{option}</button>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section>
      <h2>Remember the numbers</h2>
      {show ? <p className="prompt">{sequence}</p> : (
        <form onSubmit={(event) => {
          event.preventDefault()
          if (typed === sequence) setHits((value) => value + 1)
          setTyped('')
          setIndex((value) => value + 1)
        }}>
          <input aria-label="Type the numbers" inputMode="numeric" value={typed} onChange={(event) => setTyped(event.target.value.replace(/\D/g, ''))} />
          <button className="btn" type="submit">Next</button>
        </form>
      )}
    </section>
  )
}

function AttentionTask({ onComplete }: { onComplete: (result: TaskResult) => void }) {
  const trials = useMemo(() => [true, false, true, true, false, true, false, true], [])
  const [index, setIndex] = useState(0)
  const tapped = useRef(false)
  const correct = useRef(0)
  const done = useRef(false)
  const finish = useRef(onComplete)
  finish.current = onComplete
  useEffect(() => {
    if (index >= trials.length) {
      if (done.current) return
      done.current = true
      finish.current({ taskId: 'T9', raw: Math.round((correct.current / trials.length) * 100), reliable: true, metrics: { correct: correct.current, total: trials.length } })
      return
    }
    tapped.current = false
    const go = trials[index]
    const id = window.setTimeout(() => {
      if (!tapped.current && !go) correct.current += 1
      if (tapped.current && go) correct.current += 1
      setIndex((value) => value + 1)
    }, 1500)
    return () => window.clearTimeout(id)
  }, [index, trials])
  if (index >= trials.length) return <p>Nice tapping. Saving…</p>
  const go = trials[index]
  return (
    <section>
      <h2>Tap the star</h2>
      <p>Tap when you see a star. Leave the circle alone. The picture changes slowly.</p>
      <button
        className="stim"
        type="button"
        onClick={() => {
          tapped.current = true
        }}
      >
        {go ? 'Star' : 'Circle'}
      </button>
    </section>
  )
}

function HandTask({ childId, onComplete }: { childId: string; onComplete: (result: TaskResult) => void }) {
  return (
    <section>
      <h2>Handwriting photo</h2>
      <p>Optional. A photo is stored only on this device. It is not scored.</p>
      <input
        aria-label="Upload a handwriting photo"
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          void savePhoto({ id: crypto.randomUUID(), childId, createdAt: new Date().toISOString(), blob: file }).then(() => {
            onComplete({ taskId: 'T11', raw: 0, reliable: false, metrics: { uploaded: 1 } })
          })
        }}
      />
      <button className="btn ghost" type="button" onClick={() => onComplete({ taskId: 'T11', raw: 0, reliable: false, metrics: { uploaded: 0 } })}>Skip photo</button>
    </section>
  )
}

function VisualTask({ child, onComplete }: { child: ChildRecord; onComplete: (result: TaskResult) => void }) {
  const [spacing, setSpacing] = useState(child.visual.spacing)
  const [overlay, setOverlay] = useState(child.visual.overlay)
  return (
    <section>
      <h2>What feels easiest to read?</h2>
      <p>Pick a spacing and a soft background. This changes the screen. It is not a test score.</p>
      <div className="choices">
        {(['tight', 'cozy', 'roomy'] as const).map((value) => <button key={value} className="btn ghost" type="button" onClick={() => setSpacing(value)}>{value}</button>)}
      </div>
      <div className="choices">
        {(['cream', 'blue', 'yellow'] as const).map((value) => <button key={value} className="btn ghost" type="button" onClick={() => setOverlay(value)}>{value}</button>)}
      </div>
      <button className="btn" type="button" onClick={() => {
        const next = { ...child, visual: { spacing, overlay } }
        document.documentElement.dataset.spacing = spacing
        document.documentElement.dataset.overlay = overlay
        void saveChild(next)
        onComplete({ taskId: 'T13', raw: 0, reliable: false, metrics: { saved: 1 } })
      }}>Use this</button>
    </section>
  )
}

function QuestionTask({ child, onComplete }: { child: ChildRecord; onComplete: (result: TaskResult) => void }) {
  const items = [
    ['family', 'Has anyone in the family had dyslexia or a learning difficulty?', 2],
    ['teacher', 'Has a teacher raised a reading concern?', 2],
    ['speech', 'Was there an early speech or language delay?', 1],
    ['avoid', 'Does your child avoid reading or tire very quickly?', 1],
    ['sounds', 'Are similar sounds often mixed up?', 2],
    ['look', 'Is it hard to remember how words look?', 1],
  ] as const
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const ready = items.every(([id]) => answers[id] !== undefined)
  return (
    <section>
      <h2>Parent questions</h2>
      {child.familyHistory ? <p className="hint">You already noted family history: {child.familyHistory}. Family history is one clue among many.</p> : null}
      {items.map(([id, prompt, points]) => (
        <fieldset key={id}>
          <legend>{prompt}</legend>
          <button type="button" className={answers[id] === true ? 'chip on' : 'chip'} onClick={() => setAnswers((current) => ({ ...current, [id]: true }))}>Yes ({points})</button>
          <button type="button" className={answers[id] === false ? 'chip on' : 'chip'} onClick={() => setAnswers((current) => ({ ...current, [id]: false }))}>No</button>
        </fieldset>
      ))}
      <button
        className="btn"
        type="button"
        disabled={!ready}
        onClick={() => {
          const raw = items.reduce((sum, [id, , points]) => sum + (answers[id] ? points : 0), 0)
          onComplete({ taskId: 'Q', raw, reliable: true, metrics: { riskPoints: raw } })
        }}
      >
        Save answers
      </button>
    </section>
  )
}
