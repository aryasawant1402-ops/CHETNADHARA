import { writeFileSync } from 'node:fs'

const notice = 'Demo norms — replace after clinical calibration.'
const bands = ['5-6', '7-8', '9-10', '11-13']
const tasks = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T12', 'Q']
const base = { T1: 68, T2: 70, T3: 66, T4: 64, T5: 30, T6: 72, T7: 60, T8: 62, T9: 78, T10: 70, T12: 74, Q: 3 }
const sd = { T1: 12, T2: 12, T3: 12, T4: 14, T5: 8, T6: 12, T7: 14, T8: 12, T9: 10, T10: 18, T12: 12, Q: 2 }
const bump = { '5-6': 0, '7-8': 6, '9-10': 10, '11-13': 14 }

const norms = { demo: true, notice, bands: {} }
for (const band of bands) {
  norms.bands[band] = {}
  for (const task of tasks) {
    const higherIsBetter = task !== 'Q'
    const mean = task === 'Q' ? base.Q : base[task] + bump[band]
    norms.bands[band][task] = { mean, sd: sd[task], higherIsBetter }
  }
}
writeFileSync('src/engine/norms.demo.json', JSON.stringify(norms, null, 2))
writeFileSync(
  'src/engine/weights.json',
  JSON.stringify(
    {
      phonological: 0.25,
      decoding: 0.2,
      naming: 0.15,
      orthographic: 0.15,
      fluency: 0.1,
      workingMemory: 0.05,
      questionnaire: 0.1,
    },
    null,
    2,
  ),
)

const activities = [
  ['warmup-letters', 'warmup', 'letters', 'Letter-sound warm-up', 4, 'Match letters to their sounds. Phonics is the base for every child.', 'Trace letters in clay and say the sound as you make them.', null],
  ['warmup-rhyme', 'warmup', 'rhyme', 'Rhyme match', 4, 'Pick the rhyming word. Choices come from the Datamuse rhyme API when you are online.', 'Play a sound hunt: find three things that rhyme with cat.', 'datamuse'],
  ['warmup-blend', 'warmup', 'blend', 'Push the sounds', 4, 'Blend sounds into a word, one sound at a time.', 'Clap a word into sounds, then push the sounds back together.', null],
  ['warmup-irregular', 'warmup', 'irregular', 'Tricky-word recall', 4, 'Look, hide, and find irregular words such as said and was. Pronunciations come from the dictionary API when you are online.', 'Make colour-coded word cards for said, was, and the.', 'dictionary'],
  ['warmup-spelling', 'warmup', 'spelling', 'Spot the spelling', 4, 'Choose the spelling that matches the spoken word.', 'Spell tricky words with magnetic letters.', 'dictionary'],
  ['warmup-naming', 'warmup', 'naming', 'Gentle naming', 4, 'Name pictures or colours at a calm pace and beat your own score.', 'Play a naming game in the car: colours, then animals.', null],
  ['warmup-morph', 'warmup', 'morphology', 'Build the word', 5, 'Join a base word with a prefix or suffix.', 'Write a base word and add -ing or -ed on paper slips.', null],
  ['warmup-vocab', 'warmup', 'vocabulary', 'Word links', 5, 'Connect a word to a related word. Related words come from Datamuse.', 'Pick a word from a book and say two words it makes you think of.', 'datamuse'],
  ['spark-rhyme', 'spark', 'rhyme', 'Rhyme tap', 4, 'Tap the rhyme in time with a slow beat. Active, not flashy.', 'March in place and say a rhyme on each step.', 'datamuse'],
  ['spark-naming', 'spark', 'naming', 'Naming beat', 4, 'Tap each item as you name it and try to beat your own score.', 'Echo-name objects around the room with a parent.', null],
  ['spark-voice', 'spark', 'echo', 'Echo voice', 4, 'Listen, then say the line back with your voice.', 'Take turns echo-reading one sentence each.', null],
  ['spark-puzzle', 'spark', 'puzzle', 'Pattern spark', 4, 'Finish a shape pattern. A confident win in a strong skill.', 'Build the same pattern with spoons or blocks on the table.', null],
  ['wind-story', 'winddown', 'story', 'Calm story', 6, 'A short public-domain story with audio support, then a mood check.', 'Retell the story in your own words before bed.', 'childrenstory'],
  ['wind-breathe', 'winddown', 'breathe', 'Slow breathing', 3, 'Breathe in and out together, then mark how the session felt.', 'Three slow breaths, then a stretch.', null],
]

const library = activities.map(([id, phase, kind, title, minutes, summary, offline, api]) => ({
  id, phase, kind, title, minutes, summary, offline, api,
}))

const sets = {
  phonological: {
    '5-7': ['warmup-letters', 'warmup-rhyme', 'warmup-blend'],
    '8-10': ['warmup-blend', 'warmup-rhyme', 'warmup-letters'],
    '11-13': ['warmup-morph', 'warmup-blend', 'warmup-rhyme'],
  },
  'surface-orthographic': {
    '5-7': ['warmup-irregular', 'warmup-spelling', 'warmup-letters'],
    '8-10': ['warmup-spelling', 'warmup-irregular', 'warmup-vocab'],
    '11-13': ['warmup-spelling', 'warmup-vocab', 'warmup-irregular'],
  },
  'rapid-naming': {
    '5-7': ['warmup-naming', 'spark-naming', 'warmup-letters'],
    '8-10': ['warmup-naming', 'spark-naming', 'spark-voice'],
    '11-13': ['warmup-naming', 'spark-naming', 'warmup-vocab'],
  },
  'double-deficit': {
    '5-7': ['warmup-letters', 'warmup-naming', 'warmup-rhyme'],
    '8-10': ['warmup-blend', 'warmup-naming', 'warmup-rhyme'],
    '11-13': ['warmup-morph', 'warmup-naming', 'warmup-blend'],
  },
  mixed: {
    '5-7': ['warmup-letters', 'warmup-irregular', 'warmup-naming'],
    '8-10': ['warmup-blend', 'warmup-spelling', 'warmup-naming'],
    '11-13': ['warmup-morph', 'warmup-spelling', 'warmup-naming'],
  },
  'no-clear-pattern': {
    '5-7': ['warmup-letters', 'warmup-rhyme', 'warmup-blend'],
    '8-10': ['warmup-blend', 'warmup-letters', 'warmup-rhyme'],
    '11-13': ['warmup-morph', 'warmup-vocab', 'warmup-blend'],
  },
}

const matrix = {}
for (const [profile, bandsFor] of Object.entries(sets)) {
  matrix[profile] = {}
  for (const [band, ids] of Object.entries(bandsFor)) {
    matrix[profile][band] = {
      mild: [ids[0], ids[1], 'spark-voice'],
      moderate: [ids[0], ids[1], 'wind-story'],
      severe: [ids[0], 'wind-breathe', 'wind-story'],
    }
  }
}

writeFileSync(
  'src/content/activities.json',
  JSON.stringify(
    {
      notice: 'Practice map by profile tendency, age band, and severity. Phonics stays in every path. Live rhyme, word, and story text is fetched when the network allows.',
      activities: library,
      matrix,
    },
    null,
    2,
  ),
)
console.log('wrote norms, weights, activities', library.length, 'cells', 6 * 3 * 3)
