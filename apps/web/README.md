# Adnario Estimate: web app

The React + Vite + Tailwind web app described in `../../overview/README.md`, built to match the screenshots in
`../../overview/demo`. Everything it shows comes from the API (`../api`), proxied under `/api`.

```
npm run dev     # from the repo root: starts the database, API, converter and this app together
npm test        # unit tests (vitest), beside the file they test: name.test.ts
```

| Where | What |
|---|---|
| `src/lib/store.ts` | Each API path fetched once and shared (`useApi`), changes sent and re-read (`send`, `reload`) |
| `src/pages` | Sign in, the shell, Dashboard, Projects, Rate cards, Organisation |
| `src/workspace` | The project workspace: the 3D viewer (each model's XKT), the panels, the sheets, Adnario AI |
| `src/workspace/state.ts` | The API's estimate and programme shapes, and the programme as the panels draw it |

Outside the workspace the app is drawn at 90% (`.compact` in `src/index.css`), so the pages fit a laptop screen.
Open workspaces follow the server's live stream of changes (models converted, estimates saved, comments).
