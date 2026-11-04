# Lekki Office Block: files to try by hand

The demo office (three storeys, steel frame, drylined) as the files a QS firm would have, to run the whole flow
yourself in the app instead of opening the seeded estimate. Made from the demo data by
`cd apps/api && uv run python -m app.database.cli samples` (after `npm run db:fresh`); the models are copied from
`models/` (`models/fetch_models.sh`), so they are not in git.

| File | What it is | Where it goes |
|---|---|---|
| `Office_ARC.ifc`, `Office_STR.ifc`, `Office_ELE.ifc` | Architecture, structure and electrical models | A new project → upload all three → **Takeoff** |
| `Lekki_Office_Block_Programme.pdf` | The contractor's programme of works: 6 pages, 189 rows (162 activities) under phase and floor summaries: key dates, mobilisation, procurement of long-lead items, substructure, superstructure floor by floor (fabrication, erection, bolting; reinforcement, formwork, inspection, casting, curing), walls in zones, windows and doors, finishes, M&E first and second fix, commissioning per system, snagging floor by floor and handover. 1 December 2026 to 13 September 2027 within a contract to 30 September 2027 (Monday to Saturday, Nigerian holidays off) | Programme → **Upload your programme (PDF)** |
| `Lekki_Office_Block_BOQ.pdf`, `Lekki_Office_Block_BOQ.xlsx` | The priced BOQ the demo estimate gives (every line priced from Adnario Market Rates) | To compare your run against |

Steps: upload the three models and run **Takeoff**; **Generate BOQ**; **Link to cost** against *Adnario Market Rates*
(the firm's one card; every line should get a rate); **Programme** → upload the programme PDF: code reads all six
pages (189 rows, the phase and floor headings kept), the activities and their durations, links and dates stay the
firm's (239 working days, 1 December 2026 to 13 September 2027), and the AI puts the BOQ's work under the activities
that do it (a floor's slab under its reinforcement, formwork and concrete placement). Open an activity to see its BOQ
lines and cost; **Cash flow** follows.
