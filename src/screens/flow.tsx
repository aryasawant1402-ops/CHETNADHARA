import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Disclaimer, Mascot, Prose, RiskBadge, Shell, speak } from '../components/ui.tsx'
import { ReportBody } from '../components/ReportBody.tsx'
import { activityById, buildSession, listActivities, parentTips } from '../content/session.ts'
import { fetchDictionary, fetchRelated, fetchRhymes, fetchStory, type RemoteStory } from '../content/remote.ts'
import { distractors } from '../content/remote.ts'
import type { CheckRecord, ChildRecord, ReportRecord, SessionRecord } from '../db/db.ts'
import { getReport, listReports, listSessions, saveCheck, saveReport, saveSession, startCheck } from '../db/store.ts'
import { contentBand, normBand, scoreScreening } from '../engine/score.ts'
import { ageYears } from '../engine/age.ts'
import norms from '../engine/norms.demo.json' with { type: 'json' }
import weights from '../engine/weights.json' with { type: 'json' }
import type { NormTable, WeightConfig } from '../engine/score.ts'
import { tasksForAge } from '../tasks/plan.ts'
import { TaskPlayer } from '../tasks/TaskPlayer.tsx'
import { useSaveOnLock, useScreenTime } from '../timer/ScreenTime.tsx'
import { downloadReport } from '../share.ts'
import { decodeReport, encodeReport } from '../share-link.ts'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useChild } from './account.tsx'

export function CheckPage() {
  const { childId = '' } = useParams()
  const navigate = useNavigate()
  const child = useChild(childId)
  const [check, setCheck] = useState<CheckRecord | null>(null)
  const [holding, setHolding] = useState(false)
  const [ack, setAck] = useState(-1)
  const ref = useRef<CheckRecord | null>(null)
  useSaveOnLock(async () => {
    if (ref.current) await saveCheck(ref.current)
  })
  useEffect(() => {
    if (!childId) return
    void startCheck(childId).then((row) => {
      ref.current = row
      setCheck(row)
    })
  }, [childId])
  if (!child || !check) return <Shell><p>Loading the check…</p></Shell>
  const age = ageYears(child.dob)
  if (age === null || age < 5 || age > 13) {
    return <Shell><p role="alert">ChetnaDhara checks are for children aged 5 to 13. Please check the date of birth.</p></Shell>
  }
  const plan = tasksForAge(age)
  const apply = (next: CheckRecord) => {
    ref.current = next
    setCheck(next)
    void saveCheck(next)
  }
  if (!check.gateOk) {
    return (
      <Shell>
        <h1>Before you start</h1>
        <Mascot age={age} name={child.nickname} />
        <Prose text="Three short sittings, about ten minutes each. You can stop and come back. No camera is used." />
        {child.familyHistory ? <p>Family history is one clue among many. The check still looks at skills, and it is not a diagnosis.</p> : null}
        <Gate
          onReady={() => apply({ ...check, gateOk: true })}
          onWait={() => setHolding(true)}
        />
        {holding ? <p>Come back when the room is quiet and your child is comfortable. We will not guess a score.</p> : null}
      </Shell>
    )
  }
  const task = plan[check.cursor]
  const previous = plan[check.cursor - 1]
  if (!task) return <Shell><p>Building the report…</p></Shell>
  if (previous && previous.sitting !== task.sitting && ack !== check.cursor) {
    return (
      <Shell>
        <h1>Sitting {previous.sitting} is saved</h1>
        <p>You can stop here. The next sitting is ready when you are.</p>
        <Link className="btn ghost" to={`/dashboard/${child.id}`}>Pause</Link>
        <button className="btn" type="button" onClick={() => setAck(check.cursor)}>Continue sitting {task.sitting}</button>
      </Shell>
    )
  }
  return (
    <Shell>
      <p className="hint">Sitting {task.sitting} of 3 · {task.title}</p>
      <Mascot age={age} name={child.nickname} />
      <TaskPlayer
        key={`${check.id}-${task.id}-${check.cursor}`}
        taskId={task.id}
        age={age}
        child={child}
        onComplete={(result) => {
          const results = [...check.results, result]
          const cursor = check.cursor + 1
          const next = { ...check, results, cursor }
          apply(next)
          if (cursor >= plan.length) finish(child, next, age, navigate)
        }}
      />
    </Shell>
  )
}

function finish(child: ChildRecord, check: CheckRecord, age: number, navigate: (path: string) => void) {
  const score = scoreScreening({
    age,
    tasks: check.results.map((result) => ({ taskId: result.taskId, raw: result.raw, reliable: result.reliable })),
    norms: norms as NormTable,
    weights: weights as WeightConfig,
  })
  const id = crypto.randomUUID()
  const report: ReportRecord = { id, childId: child.id, createdAt: new Date().toISOString(), age, score }
  void saveReport(report)
  void saveCheck({ ...check, status: 'complete' })
  navigate(`/report/${id}`)
}

function Gate({ onReady, onWait }: { onReady: () => void; onWait: () => void }) {
  const [lighting, setLighting] = useState(false)
  const [sound, setSound] = useState(false)
  const [comfort, setComfort] = useState<'yes' | 'no' | ''>('')
  const [quiet, setQuiet] = useState<'yes' | 'no' | ''>('')
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (comfort !== 'yes' || quiet !== 'yes') {
          onWait()
          return
        }
        onReady()
      }}
    >
      <label className="check"><input type="checkbox" checked={lighting} onChange={(event) => setLighting(event.target.checked)} required /> The screen is easy to see</label>
      <label className="check"><input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} required /> Headphones or a quiet speaker are ready</label>
      <fieldset>
        <legend>Is your child comfortable to begin?</legend>
        <button type="button" className={comfort === 'yes' ? 'chip on' : 'chip'} onClick={() => setComfort('yes')}>Yes</button>
        <button type="button" className={comfort === 'no' ? 'chip on' : 'chip'} onClick={() => setComfort('no')}>Not yet</button>
      </fieldset>
      <fieldset>
        <legend>Is the room reasonably quiet?</legend>
        <button type="button" className={quiet === 'yes' ? 'chip on' : 'chip'} onClick={() => setQuiet('yes')}>Yes</button>
        <button type="button" className={quiet === 'no' ? 'chip on' : 'chip'} onClick={() => setQuiet('no')}>Too noisy</button>
      </fieldset>
      <button className="btn" type="submit">Start sitting 1</button>
    </form>
  )
}

export function ReportPage() {
  const { reportId = '' } = useParams()
  const [report, setReport] = useState<ReportRecord | null>(null)
  const child = useChild(report?.childId)
  useEffect(() => { void getReport(reportId).then((row) => setReport(row ?? null)) }, [reportId])
  if (!report) return <Shell><p>Loading the report…</p></Shell>
  const link = `${window.location.origin}/teacher#${encodeReport({ report, childName: child?.nickname ?? 'Child' })}`
  return (
    <Shell>
      <ReportBody report={report} childName={child?.nickname ?? 'Child'} />
      <div className="choices">
        <button className="btn" type="button" onClick={() => downloadReport(report, child?.nickname ?? 'child')}>Download PDF</button>
        <button className="btn ghost" type="button" onClick={() => void navigator.clipboard.writeText(link)}>Copy teacher view link</button>
        <Link className="btn ghost" to={`/child/${report.childId}/plan`}>Daily plan</Link>
      </div>
      <p className="hint">The teacher link is a read-only copy of this report. It contains the same screening text.</p>
    </Shell>
  )
}

export function TeacherPage() {
  const payload = decodeReport<{ report: ReportRecord; childName: string }>(window.location.hash.replace('#', ''))
  if (!payload) return <Shell><p>This teacher link is incomplete. Ask the parent for a new one.</p></Shell>
  return (
    <Shell>
      <p className="banner">Read-only teacher view</p>
      <ReportBody report={payload.report} childName={payload.childName} />
    </Shell>
  )
}

export function PlanPage() {
  const { childId = '' } = useParams()
  const child = useChild(childId)
  const { remaining } = useScreenTime()
  const [report, setReport] = useState<ReportRecord | null>(null)
  useEffect(() => {
    void listReports(childId).then((rows) => setReport(rows.at(-1) ?? null))
  }, [childId])
  if (!child) return <Shell><p>Loading…</p></Shell>
  const age = ageYears(child.dob) ?? 0
  if (!report) {
    return <Shell><h1>Daily plan</h1><p>Finish a ChetnaDhara Check first so the plan can match the skill profile.</p><Link className="btn" to={`/child/${childId}/check`}>Start the check</Link></Shell>
  }
  const session = buildSession(report.score, age, (remaining ?? 30) / 60)
  return (
    <Shell>
      <Mascot age={age} name={child.nickname} />
      <h1>Today’s energy curve</h1>
      <RiskBadge risk={report.score.risk} />
      <p>{session.note}</p>
      <p>Phonics stays in the plan for every child. Profile: {session.profileLabel}.</p>
      {session.specialistPrompt ? <p>A specialist visit is the priority alongside these short activities.</p> : null}
      {session.activities.length === 0 ? (
        <ul>{session.offline.map((line) => <li key={line}>{line}</li>)}</ul>
      ) : (
        <ol className="stack">
          {session.activities.map((activity, index) => (
            <li key={`${activity.id}-${index}`} className="card">
              <p>{index === 0 ? 'Warm-up' : index === 1 ? 'Spark' : 'Wind-down'}</p>
              <h2>{activity.title}</h2>
              <p>{activity.summary}</p>
              <p className="hint">About {activity.minutes} minutes{activity.showTimer ? '' : ' · no race timer'}</p>
              <Link className="btn" to={`/child/${childId}/play/${activity.id}`}>Start</Link>
            </li>
          ))}
        </ol>
      )}
      <h2>Offline together</h2>
      <ul>{session.offline.map((line) => <li key={line}>{line}</li>)}</ul>
    </Shell>
  )
}

export function PlayPage() {
  const { childId = '', activityId = '' } = useParams()
  const child = useChild(childId)
  const activity = activityById(activityId)
  const [done, setDone] = useState(false)
  const [severe, setSevere] = useState(false)
  useEffect(() => {
    void listReports(childId).then((rows) => setSevere(rows.at(-1)?.score.severity === 'severe'))
  }, [childId])
  useSaveOnLock(async () => {
    sessionStorage.setItem('chetnadhara.draft', JSON.stringify({ childId, activityId, at: Date.now() }))
  })
  if (!activity || !child) return <Shell><p>That activity is not in the library.</p></Shell>
  const age = ageYears(child.dob) ?? 8
  if (done) return <Shell><h1>Lovely work, {child.nickname}</h1><Link className="btn" to={`/child/${childId}/plan`}>Back to the plan</Link></Shell>
  return (
    <Shell>
      <p className="hint">{activity.phase} · {activity.api ? `Uses ${activity.api}` : 'On-device activity'}</p>
      <h1>{activity.title}</h1>
      <Prose text={activity.summary} />
      <ActivityRun
        kind={activity.kind}
        age={age}
        showTimer={!severe}
        onDone={async (mood, confidence) => {
          const row: SessionRecord = { id: crypto.randomUUID(), childId, createdAt: new Date().toISOString(), activityId, title: activity.title, mood, confidence }
          await saveSession(row)
          setDone(true)
        }}
      />
    </Shell>
  )
}

function ActivityRun({ kind, age, showTimer, onDone }: { kind: string; age: number; showTimer: boolean; onDone: (mood: number, confidence: number) => void }) {
  const band = contentBand(age)
  if (kind === 'story' || kind === 'breathe') return <WindDown band={band} breathe={kind === 'breathe'} onDone={onDone} />
  if (kind === 'rhyme') return <RhymePlay age={age} onDone={() => onDone(2, 3)} />
  if (kind === 'naming') return <NamingPlay showTimer={showTimer} onDone={() => onDone(2, 4)} />
  if (kind === 'vocabulary' || kind === 'morphology') return <WordPlay kind={kind} onDone={() => onDone(2, 3)} />
  if (kind === 'irregular' || kind === 'spelling' || kind === 'letters' || kind === 'blend' || kind === 'echo' || kind === 'puzzle') {
    return <SimplePlay kind={kind} onDone={() => onDone(2, 3)} />
  }
  return <SimplePlay kind="letters" onDone={() => onDone(2, 3)} />
}

function RhymePlay({ age, onDone }: { age: number; onDone: () => void }) {
  const seed = age < 11 ? 'cat' : 'light'
  const [words, setWords] = useState<string[]>([])
  const [source, setSource] = useState('')
  useEffect(() => { void fetchRhymes(seed).then((result) => { setWords(result.words); setSource(result.source) }) }, [seed])
  const answer = words[0]
  if (!answer) return <p>Fetching rhymes…</p>
  const options = [answer, ...distractors(answer, words)]
  return (
    <section>
      <p className="hint">Word list: {source}. Tap in time with a slow clap.</p>
      <p className="prompt pulse">Rhymes with {seed}</p>
      <div className="choices">
        {options.map((word) => <button key={word} className="btn ghost" type="button" onClick={onDone}>{word}</button>)}
      </div>
    </section>
  )
}

function NamingPlay({ showTimer, onDone }: { showTimer: boolean; onDone: () => void }) {
  const items = ['red', 'star', 'blue', 'cup']
  const [left, setLeft] = useState(items.length)
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!showTimer) return
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(id)
  }, [showTimer])
  return (
    <section>
      <p>Say it, then tap it. Beat your own score next time.</p>
      {showTimer ? <p>Time {seconds}s</p> : <p>No race timer on this turn.</p>}
      <div className="choices">
        {items.map((item) => <button key={item} className="btn ghost" type="button" onClick={() => setLeft((value) => value - 1)}>{item}</button>)}
      </div>
      {left <= 0 ? <button className="btn" type="button" onClick={onDone}>Done</button> : null}
    </section>
  )
}

function WordPlay({ kind, onDone }: { kind: string; onDone: () => void }) {
  const [words, setWords] = useState<string[]>([])
  const [source, setSource] = useState('')
  useEffect(() => {
    if (kind === 'vocabulary') void fetchRelated('story').then((result) => { setWords(result.words); setSource(result.source) })
  }, [kind])
  if (kind === 'morphology') {
    return (
      <section>
        <p>Join help + ful</p>
        <div className="choices">
          {['helpful', 'helpness', 'rehelp'].map((word) => <button key={word} className="btn ghost" type="button" onClick={onDone}>{word}</button>)}
        </div>
      </section>
    )
  }
  return (
    <section>
      <p className="hint">{source || 'Finding related words…'}</p>
      <div className="choices">
        {(words.length ? words : ['book', 'page']).map((word) => <button key={word} className="btn ghost" type="button" onClick={onDone}>{word}</button>)}
      </div>
    </section>
  )
}

function SimplePlay({ kind, onDone }: { kind: string; onDone: () => void }) {
  const [extra, setExtra] = useState('')
  useEffect(() => {
    if (kind === 'irregular' || kind === 'spelling') {
      void fetchDictionary('said').then((entry) => setExtra(`${entry.phonetic} ${entry.definition} (${entry.source})`))
    }
  }, [kind])
  const prompt = kind === 'blend' ? 'c · a · t' : kind === 'echo' ? 'The cat sat on the mat.' : kind === 'puzzle' ? 'Circle, square, circle, ___' : 'said'
  return (
    <section>
      <p className="prompt">{prompt}</p>
      {extra ? <p>{extra}</p> : null}
      <button className="chip" type="button" onClick={() => speak(prompt)}>Listen</button>
      <button className="btn" type="button" onClick={onDone}>I did it</button>
    </section>
  )
}

function WindDown({ band, breathe, onDone }: { band: '5-7' | '8-10' | '11-13'; breathe: boolean; onDone: (mood: number, confidence: number) => void }) {
  const [story, setStory] = useState<RemoteStory | null>(null)
  const [mood, setMood] = useState(2)
  const [confidence, setConfidence] = useState(3)
  const [step, setStep] = useState(breathe ? 'breathe' : 'story')
  useEffect(() => { if (!breathe) void fetchStory(band).then(setStory) }, [band, breathe])
  useEffect(() => {
    if (step !== 'breathe') return
    const id = window.setTimeout(() => setStep('mood'), 8000)
    return () => window.clearTimeout(id)
  }, [step])
  if (step === 'breathe') return <section><h2>Breathe in slowly, then out.</h2><p>Stay with one calm breath. No flashing.</p></section>
  if (step === 'story' && story) {
    return (
      <section>
        <h2>{story.title}</h2>
        <p className="hint">{story.credit}</p>
        <Prose text={story.text} />
        <button className="btn" type="button" onClick={() => setStep('breathe')}>Breathing next</button>
      </section>
    )
  }
  if (step === 'story') return <p>Fetching a public-domain story…</p>
  return (
    <section>
      <h2>How did that feel?</h2>
      <div className="choices" role="group" aria-label="Mood">
        {[1, 2, 3].map((value) => <button key={value} className={mood === value ? 'chip on' : 'chip'} type="button" onClick={() => setMood(value)}>{value === 1 ? 'Tough' : value === 2 ? 'Okay' : 'Proud'}</button>)}
      </div>
      <label>Confidence after this session
        <input type="range" min={1} max={5} value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} />
      </label>
      <button className="btn" type="button" onClick={() => onDone(mood, confidence)}>Save</button>
    </section>
  )
}

export function DashboardPage() {
  const { childId = '' } = useParams()
  const child = useChild(childId)
  const [reports, setReports] = useState<ReportRecord[]>([])
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  useEffect(() => {
    void listReports(childId).then(setReports)
    void listSessions(childId).then(setSessions)
  }, [childId])
  if (!child) return <Shell><p>Loading the dashboard…</p></Shell>
  const latest = reports.at(-1)
  const age = ageYears(child.dob) ?? 8
  const chart = reports.map((report) => {
    const row: Record<string, string | number> = { day: report.createdAt.slice(5, 10) }
    for (const dim of report.score.dimensions) {
      if (dim.z === null) continue
      row[dim.shortLabel] = Math.max(8, Math.min(98, Math.round(50 + dim.z * 15)))
    }
    return row
  })
  const keys = chart[0] ? Object.keys(chart[0]).filter((key) => key !== 'day') : []
  const streak = streakDays(sessions)
  const week = sessions.filter((row) => Date.now() - new Date(row.createdAt).getTime() < 7 * 86400000)
  const tips = parentTips(latest?.score.profile ?? 'no-clear-pattern')
  return (
    <Shell>
      <h1>Parent dashboard</h1>
      <Mascot age={age} name={child.nickname} />
      <p className="banner">{norms.notice}</p>
      {latest ? <RiskBadge risk={latest.score.risk} /> : <p>No check yet.</p>}
      <h2>Reading-skill progress</h2>
      {chart.length > 0 ? (
        <div className="chart">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chart}>
              <XAxis dataKey="day" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              {keys.slice(0, 4).map((key) => <Line key={key} type="monotone" dataKey={key} stroke="#0f6e6b" dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <p>Progress lines appear after the first report.</p>}
      <h2>Weekly win report</h2>
      <p>Strengths first: {latest ? latest.score.strengths.join(', ') : 'A check will show them.'}</p>
      <p>Activities finished this week: {week.length}. Streak: {streak} day{streak === 1 ? '' : 's'}. A missed day simply starts again when you are ready.</p>
      <p>Mood marks: {week.map((row) => row.mood).join(', ') || 'none yet'}.</p>
      <h2>Tips</h2>
      <ul>{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      <h2>5 minutes tonight</h2>
      <ul>{(latest ? buildSession(latest.score, age, 30).offline : ['Read one page together.']).map((line) => <li key={line}>{line}</li>)}</ul>
      {latest?.score.risk === 'medium' ? <p>Re-check around {new Date(new Date(latest.createdAt).getTime() + 42 * 86400000).toLocaleDateString()}.</p> : null}
      <div className="choices">
        <Link className="btn" to={`/child/${childId}/plan`}>Daily plan</Link>
        {latest ? <button className="btn ghost" type="button" onClick={() => downloadReport(latest, child.nickname)}>Clinician PDF</button> : null}
        <button className="btn ghost" type="button" onClick={() => window.print()}>Print offline sheet</button>
      </div>
      <section className="print-sheet">
        <h2>Offline sheet for {child.nickname}</h2>
        <ul>{listActivities().slice(0, 6).map((item) => <li key={item.id}>{item.offline}</li>)}</ul>
        <Disclaimer />
      </section>
      <p className="hint">Norm band for this age: {normBand(age)}. {norms.notice}</p>
    </Shell>
  )
}

function streakDays(sessions: SessionRecord[]): number {
  const days = new Set(sessions.map((row) => row.createdAt.slice(0, 10)))
  let streak = 0
  const cursor = new Date()
  for (let i = 0; i < 30; i += 1) {
    const day = cursor.toISOString().slice(0, 10)
    if (!days.has(day)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function MissingPage() {
  return <Navigate to="/" />
}
