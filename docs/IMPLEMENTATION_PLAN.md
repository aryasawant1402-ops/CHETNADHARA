# ChetnaDhara implementation plan

Website for parents of children aged 5–13. It screens **reading-skill risk** and builds a daily practice plan. It does not diagnose.

## Locked decisions

- English only. No Hindi or Marathi UI.
- Browser website (Vite). Not a native app and not an installable home-screen app.
- No webcam and no gaze tracking. Passage reading uses a timer and a self-reported reread count.
- One parent on this browser, many child profiles. No comparison between children.
- Teacher view is a read-only link: the report snapshot is stored in the URL hash. PDF is the print handoff.
- Demo sign-in, labelled as demo. 4-digit parent PIN (SHA-256) gates screen-time changes. Data stays in IndexedDB.
- Screen-time defaults: 5–7 = 30 min, 8–10 = 45 min, 11–13 = 60 min, parent PIN can raise the cap to 120. WHO note stays visible.

## Content APIs

| Use | API | How the site calls it |
| --- | --- | --- |
| Rhymes and related words | [Datamuse](https://api.datamuse.com/words) | Direct from the browser (CORS allowed) |
| Pronunciation and short definitions | [dictionaryapi.dev](https://dictionaryapi.dev/) | Direct from the browser, local fallback |
| Public-domain stories | [ChildrenStory](https://childrenstory.org/api/stories.json) | Dev/preview proxy at `/remote/childrenstory` because the host does not send CORS headers. Bundled public-domain fallbacks if the fetch fails |

Norm tables in `src/engine/norms.demo.json` are placeholders. The report UI says **Demo norms — replace after clinical calibration.**

## Build order

1. This plan.
2. Design system, accessibility modes, screen-time timer.
3. Demo auth, consent, child profiles, age gate 5–13.
4. Scoring engine and unit tests (Low, Medium, High, Unclear, each profile tendency).
5. Screening tasks T1–T13 plus parent questionnaire. Three resumable sittings.
6. Report, teacher view, PDF.
7. Session generator and activity library (3 entries per profile × age band × severity).
8. Parent dashboard.
9. English copy only. No installable app shell. IndexedDB still keeps data on the device.
10. Unit tests, production build, browser pass.

## Scoring (pure TypeScript)

- z-score each reliable task against the age-band demo norm. Higher raw is better except questionnaire risk points.
- Dimensions: phonological (T1–T3), decoding (T4), orthographic (T6–T7), rapid naming (T5), working memory (T8), fluency (T10), plus questionnaire. Attention (T9) and reasoning (T12) are reported and can add a caution note. They are not in the risk weights.
- Flag at z ≤ −1. Strong flag at z ≤ −1.5.
- Weights: phonological 0.25, decoding 0.20, naming 0.15, orthographic 0.15, fluency 0.10, working memory 0.05, questionnaire 0.10. Dropped signals are left out and the rest are rescaled.
- Unclear when more than half of the applicable weighted signals are unreliable, or fewer than two weighted signals are reliable.
- Low = 0–1 flags. Medium = 2–3 flags or one strong flag. High = 4+ flags or 2+ strong flags.
- Profile tendency, not a subtype label. Phonics is the base for every plan.

## Safety copy

Never write that a child has dyslexia. Risk badge uses sage, amber, and plum. No red fail screens, no leaderboards, no flashing (nothing steps faster than twice a second). Footer disclaimer on every report view, including the teacher link and the PDF.
