export function localDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function remainingSeconds(usedSeconds: number, limitMinutes: number): number {
  return Math.max(0, Math.round(limitMinutes * 60 - usedSeconds))
}

export function shouldChime(previousRemaining: number, nextRemaining: number): boolean {
  return previousRemaining > 300 && nextRemaining <= 300
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
