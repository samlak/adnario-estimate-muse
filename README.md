# Adnario Estimate

From building model to a measured, priced bill of quantities, a programme and a cash flow. How the app works is in
[`overview/README.md`](overview/README.md); `overview/` holds the reference material (screenshots, rate card,
samples, the sidekick walkthrough) and nothing runs from it but the data the app reads.

| App | What it is | Port |
|---|---|---|
| [`apps/web`](apps/web) | React + Vite + Tailwind web app | 3000 |
| [`apps/api`](apps/api) | FastAPI: auth, projects, models, the estimate run, BOQ, pricing, programme, cash flow, exports, Adnario AI | 8000 |
| [`apps/converter`](apps/converter) | Node: IFC → XKT for the 3D viewer (xeokit-convert + web-ifc) | 8100 |
| Postgres 16 (Docker) | Every firm's data, behind row-level security | 55622 |

Each takes the next free port when its own is busy; `npm run dev` prints where everything is.

## Start it

Put the Meta Muse API key in `.env` at the repo root (copy `.env.example`):

```
MUSE_API_KEY=...
```

**Everything in Docker** (only Docker needed):

```
docker compose up --build      # then open http://localhost:8000
```

**For development** (Docker for the database, Node 20+, and [uv](https://docs.astral.sh/uv/)):

```
npm run dev       # installs on the first run, then starts db, api (live reload), converter and web together
```

Open the address it prints (http://localhost:3000) and sign in from **Demo accounts** (password `demo-password`).

An empty database is seeded with the demo firm (README §13): Lekki Office Block (three models), Ikeja Corporate
Office (one model) and Ikoyi Duplex, from `overview/samples`. The models are converted in the background; with a Muse
key, Lekki and Ikeja are then run end to end (takeoff, BOQ, rates, programme), which takes a few minutes, so they open
finished. Ikoyi is left with only its model, to run the whole flow live from the app; its programme PDF is in
`overview/samples/ikoyi-duplex`. A second firm, Northbridge Cost Consultants (`admin@northbridge.adnario.app`), shows
that one firm never sees another's data.

To start again from an empty database: `docker compose down -v`.

## Checks

```
npm run check     # the web app's rate and calendar arithmetic, and the API's BOQ refs, summary and programme reading
```

## End-to-end test

[`e2e/flow.spec.ts`](e2e/flow.spec.ts) walks the whole process in a real browser against the running app: sign in, a
new project with the Ikoyi Duplex IFC, the takeoff run, Generate BOQ, Link to cost, an edit with undo and redo, the
BOQ exports, the programme PDF, the cash flow, Adnario AI, and who may see what (roles, and another firm). It deletes
the project it made at the end (`E2E_KEEP=1` keeps it), and fails on any error in the browser.

```
npm run e2e:install   # once: Playwright's Chromium (or set E2E_CHANNEL=chrome to use the Chrome you have)
npm run e2e           # uses the app at http://localhost:3000, starting it with npm run dev if nothing answers
npm run e2e:report    # the last run's report: steps, screenshots, and a trace of anything that failed
```

The AI steps call Muse, so it needs `MUSE_API_KEY` and takes about three minutes. `E2E_URL` points it at another
address (e.g. `E2E_URL=http://localhost:8000` for the Docker stack). Results go to `e2e/results` and `e2e/report`,
which git ignores; each step's screenshot is in `e2e/results/<step>/`.
