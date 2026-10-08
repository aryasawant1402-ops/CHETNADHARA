# ChetnaDhara

English website that helps a parent screen reading-skill risk for a child aged 5–13 and practise with short activities. It does not diagnose.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

- `npm test` runs the scoring tests
- `npm run build` makes a static site
- Stories are fetched through the dev/preview proxy at `/remote/childrenstory`. Rhymes use Datamuse directly. If a request fails, the page uses the bundled fallback.

The plan is in `docs/IMPLEMENTATION_PLAN.md`. Norms in the app are demo placeholders.
