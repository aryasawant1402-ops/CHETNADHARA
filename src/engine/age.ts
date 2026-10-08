export function ageYears(dob: string, today = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const born = new Date(year, month - 1, day)
  if (born.getFullYear() !== year || born.getMonth() !== month - 1 || born.getDate() !== day) return null
  let age = today.getFullYear() - year
  const monthDelta = today.getMonth() - (month - 1)
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < day)) age -= 1
  return age
}

export function ageAllowed(age: number | null): age is number {
  return age !== null && age >= 5 && age <= 13
}

export function defaultLimitMinutes(age: number): number {
  if (age <= 7) return 30
  if (age <= 10) return 45
  return 60
}
