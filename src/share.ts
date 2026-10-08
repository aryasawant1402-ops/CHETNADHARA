import { jsPDF } from 'jspdf'
import { CLINICIANS } from './copy.ts'
import type { ReportRecord } from './db/db.ts'
import { PROFILE_LABEL } from './engine/score.ts'

export function downloadReport(report: ReportRecord, childName: string) {
  const doc = new jsPDF()
  const lines = [
    `ChetnaDhara reading-skill report for ${childName}`,
    report.score.normsNotice,
    `Screening risk: ${report.score.risk}`,
    `Profile tendency: ${PROFILE_LABEL[report.score.profile]}`,
    `Session band: ${report.score.severity}`,
    report.score.explanation,
    report.score.confidenceNote,
    `Strength spotted: ${report.score.strengths.join(', ')}`,
    `Main need: ${report.score.mainNeed ?? 'n/a'}`,
    `Secondary need: ${report.score.secondaryNeed ?? 'n/a'}`,
    ...report.score.notes,
    'What to do next:',
    ...report.score.nextSteps,
    'Specialist types to ask about:',
    ...CLINICIANS,
    'Reading-skill progress (demo scale, higher is stronger):',
    ...report.score.dimensions.map((dim) => `${dim.label}: ${dim.status}${dim.z === null ? '' : ` z ${dim.z.toFixed(2)}`}`),
    report.score.disclaimer,
  ]
  let y = 16
  for (const line of lines) {
    const parts = doc.splitTextToSize(line, 180)
    for (const part of parts) {
      if (y > 280) {
        doc.addPage()
        y = 16
      }
      doc.text(part, 14, y)
      y += 7
    }
  }
  doc.save(`chetnadhara-${childName.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}
