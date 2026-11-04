# Ikoyi Duplex: files to try by hand

The demo's duplex: a two-storey house, one architecture model (a public Revit sample, IFC2x3: steel beams, stud and
block walls, timber flat roof). Made from the demo data by `cd apps/api && uv run python -m app.database.cli samples`
(after `npm run db:fresh`); the model is copied from `models/` (`models/fetch_models.sh`), so it is not in git.

| File | What it is | Where it goes |
|---|---|---|
| `Ifc2x3_Duplex_Architecture.ifc` | The building: walls, slabs, beams, stairs and railings, 14 doors, 24 windows, ceilings, furniture | A new project → upload it → **Takeoff** |
| `Ikoyi_Duplex_Programme.pdf` | The contractor's programme of works: 4 pages, 128 rows (104 activities) under phase and floor summaries, from the letter of award on 1 February 2027 to completion on 24 July 2027 within a contract to 30 July 2027 (Monday to Saturday, Nigerian holidays off) | Programme → **Upload your programme (PDF)** |
| `Ikoyi_Duplex_BOQ.pdf`, `Ikoyi_Duplex_BOQ.xlsx` | The BOQ a run on the model gives: 44 items, every one priced from Adnario Market Rates | To compare your run against |

The demo project **Ikoyi Duplex** has only this model uploaded, so the whole flow can be run live in it. Steps: run
**Takeoff** (about 3 minutes; the furniture and kitchen units are in **Not measured**,
where you can add a type to the takeoff if you want it billed); **Generate BOQ**; **Link to cost**; **Programme** →
upload the programme PDF: its activities become the programme (about 146 working days) and the BOQ's work goes
under them.
