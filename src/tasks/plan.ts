export interface PlannedTask {
  id: string
  title: string
  sitting: number
  min: number
  max: number
}

const TASKS: PlannedTask[] = [
  { id: 'T13', title: 'Visual comfort', sitting: 1, min: 5, max: 13 },
  { id: 'T1', title: 'Letter sounds', sitting: 1, min: 5, max: 8 },
  { id: 'T2', title: 'Rhyme and first sound', sitting: 1, min: 5, max: 9 },
  { id: 'T3', title: 'Sound blending', sitting: 1, min: 5, max: 10 },
  { id: 'T12', title: 'Puzzle', sitting: 1, min: 5, max: 13 },
  { id: 'T8', title: 'Memory span', sitting: 2, min: 5, max: 13 },
  { id: 'T6', title: 'Tricky words', sitting: 2, min: 6, max: 13 },
  { id: 'T7', title: 'Spelling', sitting: 3, min: 7, max: 13 },
  { id: 'T9', title: 'Attention tap', sitting: 3, min: 5, max: 13 },
  { id: 'T11', title: 'Handwriting photo', sitting: 3, min: 7, max: 13 },
  { id: 'Q', title: 'Parent questions', sitting: 3, min: 5, max: 13 },
]

export function tasksForAge(age: number): PlannedTask[] {
  return TASKS.filter((task) => age >= task.min && age <= task.max)
}
