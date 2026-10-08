import fallbacks from './story-fallbacks.json' with { type: 'json' }

export interface RemoteStory {
  title: string
  text: string
  credit: string
}

interface CatalogItem {
  title: string
  slug: string
  category: string
  words: number
  markdown: string
}

const RHYMES: Record<string, string[]> = {
  cat: ['hat', 'mat', 'sat', 'bat'],
  sun: ['fun', 'run', 'bun'],
  play: ['day', 'say', 'way'],
  light: ['night', 'kite', 'bright'],
  train: ['rain', 'brain', 'plain'],
  story: ['glory', 'morning'],
  friend: ['end', 'send', 'bend'],
  clear: ['near', 'year', 'hear'],
  bright: ['light', 'night', 'sight'],
}

const DEFINITIONS: Record<string, { phonetic: string; definition: string }> = {
  said: { phonetic: '/sed/', definition: 'Past of say. It does not sound like the letters look.' },
  was: { phonetic: '/woz/', definition: 'Past of is. The a does not say its usual sound.' },
  the: { phonetic: '/thuh/', definition: 'A very common word. It is easier to remember as a whole.' },
  they: { phonetic: '/thay/', definition: 'More than one person.' },
  because: { phonetic: '/bih-koz/', definition: 'For the reason that.' },
  once: { phonetic: '/wuns/', definition: 'One time.' },
  friend: { phonetic: '/frend/', definition: 'A person you like. The i is quiet.' },
  island: { phonetic: '/eye-land/', definition: 'Land with water around it. The s is quiet.' },
  yacht: { phonetic: '/yot/', definition: 'A boat. The spelling is unusual.' },
}

let catalog: CatalogItem[] | null = null

function cleanStory(markdown: string, fallbackTitle: string): RemoteStory {
  const lines = markdown.split('\n').map((line) => line.trim())
  const titleLine = lines.find((line) => line.startsWith('# '))
  const title = titleLine ? titleLine.replace(/^#\s+/, '') : fallbackTitle
  const body = lines
    .filter((line) => line && !line.startsWith('#') && line !== '---' && !line.startsWith('From ChildrenStory') && !line.startsWith('Public domain'))
    .map((line) => line.replaceAll('*', ''))
    .join('\n')
  return { title, text: body, credit: 'Public-domain text. Live copy from ChildrenStory.org when the network allows.' }
}

export async function fetchRhymes(seed: string): Promise<{ words: string[]; source: string }> {
  const local = RHYMES[seed] ?? ['hat', 'sun', 'day']
  try {
    const response = await fetch(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(seed)}&md=s&max=12`, { signal: AbortSignal.timeout(6000) })
    if (!response.ok) throw new Error('datamuse')
    const rows = (await response.json()) as { word: string; numSyllables?: number }[]
    const words = rows
      .filter((row) => /^[a-z]+$/i.test(row.word) && (row.numSyllables ?? 1) <= 2)
      .map((row) => row.word.toLowerCase())
      .filter((word) => word !== seed)
    if (words.length < 2) throw new Error('short')
    return { words: words.slice(0, 6), source: 'Datamuse' }
  } catch {
    return { words: local, source: 'Offline word list' }
  }
}

export async function fetchRelated(seed: string): Promise<{ words: string[]; source: string }> {
  try {
    const response = await fetch(`https://api.datamuse.com/words?rel_trg=${encodeURIComponent(seed)}&max=8`, { signal: AbortSignal.timeout(6000) })
    if (!response.ok) throw new Error('datamuse')
    const rows = (await response.json()) as { word: string }[]
    const words = rows.map((row) => row.word).filter((word) => /^[a-z]+$/i.test(word))
    if (words.length < 2) throw new Error('short')
    return { words: words.slice(0, 5), source: 'Datamuse' }
  } catch {
    return { words: ['book', 'page', 'story', 'read'], source: 'Offline word list' }
  }
}

export async function fetchDictionary(word: string): Promise<{ phonetic: string; definition: string; source: string }> {
  const local = DEFINITIONS[word.toLowerCase()] ?? { phonetic: '', definition: 'A word to remember as a whole.' }
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(6000) })
    if (!response.ok) throw new Error('dictionary')
    const rows = (await response.json()) as { phonetic?: string; meanings?: { definitions?: { definition: string }[] }[] }[]
    const entry = rows[0]
    const definition = entry?.meanings?.[0]?.definitions?.[0]?.definition
    if (!definition) throw new Error('empty')
    return { phonetic: entry.phonetic || local.phonetic, definition, source: 'dictionaryapi.dev' }
  } catch {
    return { ...local, source: 'Offline note' }
  }
}

async function loadCatalog(): Promise<CatalogItem[]> {
  if (catalog) return catalog
  const response = await fetch('/remote/childrenstory/api/stories.json', { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error('catalog')
  const data = (await response.json()) as { stories: CatalogItem[] }
  catalog = data.stories
  return catalog
}

function fallbackStory(band: '5-7' | '8-10' | '11-13'): RemoteStory {
  const pool = (fallbacks as { title?: string; text: string }[]).map((item) => cleanStory(item.text, 'Story'))
  if (band === '5-7') return pool.find((item) => item.title.includes('Jack') || item.title.includes('Baa')) ?? pool[0]
  if (band === '11-13') return pool[0]
  return pool[1] ?? pool[0]
}

export async function fetchStory(band: '5-7' | '8-10' | '11-13'): Promise<RemoteStory> {
  const range = band === '5-7' ? [12, 90] : band === '8-10' ? [40, 180] : [70, 280]
  try {
    const stories = await loadCatalog()
    const pick = stories.filter((item) => item.words >= range[0] && item.words <= range[1] && item.category !== 'holiday')
    const choice = pick[Math.floor(Math.random() * Math.min(pick.length, 12))] ?? stories[0]
    if (!choice) return fallbackStory(band)
    const response = await fetch(`/remote/childrenstory${new URL(choice.markdown).pathname}`, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error('story')
    const story = cleanStory(await response.text(), choice.title)
    return { ...story, credit: `Public domain via ChildrenStory.org — ${choice.title}` }
  } catch {
    return fallbackStory(band)
  }
}

export function distractors(correct: string, pool: string[]): string[] {
  const others = ['sun', 'tree', 'book', 'frog', 'milk', 'jump'].filter((word) => word !== correct && !pool.includes(word))
  const unique = [...new Set(pool.filter((word) => word !== correct))]
  while (unique.length < 2) unique.push(others[unique.length] ?? 'tree')
  return unique.slice(0, 2)
}
