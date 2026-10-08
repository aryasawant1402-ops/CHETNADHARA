import type { ReportRecord } from '../db/db.ts'
import { PROFILE_LABEL } from '../engine/score.ts'
import { Disclaimer, RiskBadge, speak } from './ui.tsx'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import { useA11y } from '../a11y/A11y.tsx'
import { CLINICIANS } from '../copy.ts'

export function ReportBody({ report, childName }: { report: ReportRecord; childName: string }) {
  const { prefs } = useA11y()
  const stroke = prefs.contrast ? '#ffe14a' : prefs.dark ? '#9fd8cf' : '#0f6e6b'
  const data = report.score.dimensions
    .filter((dim) => dim.status === 'scored' && dim.z !== null)
    .map((dim) => ({ skill: dim.shortLabel, score: Math.max(8, Math.min(98, Math.round(50 + (dim.z ?? 0) * 15))) }))
  return (
    <article className="report">
      <p className="banner">{report.score.normsNotice}</p>
      <h1>Reading-skill report for {childName}</h1>
      <RiskBadge risk={report.score.risk} />
      <Disclaimer />
      <h2>Reading-skill progress</h2>
      <p className="hint">Higher on the demo scale means a stronger score. This is not neurological progress.</p>
      <div className="chart">
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="skill" />
            <Radar dataKey="score" stroke={stroke} fill={stroke} fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <h2>Strength spotted</h2>
      <ul>{report.score.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
      <p>Main need: {report.score.mainNeed ?? 'Not enough reliable scores yet.'}</p>
      <p>Secondary need: {report.score.secondaryNeed ?? 'None yet.'}</p>
      <p>Session band: {report.score.severity}. This band only sets practice length.</p>
      <h2>Profile tendency</h2>
      <p>{PROFILE_LABEL[report.score.profile]}</p>
      <p>{report.score.confidenceNote}</p>
      <button className="chip" type="button" onClick={() => speak(report.score.explanation)}>Listen</button>
      <p>{report.score.explanation}</p>
      {report.score.notes.map((note) => <p key={note}>{note}</p>)}
      <h2>What to do next</h2>
      <ul>{report.score.nextSteps.map((step) => <li key={step}>{step}</li>)}</ul>
      <section className="card">
        <h2>Who can help</h2>
        <p>Placeholder list of specialist types. No clinic names are included. Ask your school or paediatrician for a local referral.</p>
        <ul>{CLINICIANS.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <Disclaimer />
    </article>
  )
}
