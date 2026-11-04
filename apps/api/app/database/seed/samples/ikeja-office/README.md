# Ikeja Corporate Office: files to try by hand

The demo's second project: a three-storey corporate office with a roof plant level and parapet (concrete frame,
curtain walling), one model carrying architecture and structure. Made from the demo data by
`cd apps/api && uv run python -m app.database.cli samples` (after `npm run db:fresh`); the model is copied from
`models/` (`models/fetch_models.sh`: Autodesk's Revit 2024 advanced sample, IFC4), so it is not in git.

| File | What it is | Where it goes |
|---|---|---|
| `Ikeja_Office.ifc` | The building: 146 walls, 176 columns, 37 beams, 30 slabs, stairs, railings, 100 doors, 34 curtain walls, ceilings; no foundations modelled | A new project → upload it → **Takeoff** |
| `Ikeja_Corporate_Office_Programme.pdf` | The contractor's programme of works: 6 pages, 207 rows (174 activities) under phase and floor summaries, from site possession on 11 January 2027 to practical completion on 29 February 2028 (14 months) | Programme → **Upload your programme (PDF)** |
| `Ikeja_Corporate_Office_BOQ.pdf`, `Ikeja_Corporate_Office_BOQ.xlsx` | The BOQ the demo estimate gives: 44 measured items plus the 19 provisional items the QS accepted (foundations and ground slab works, formwork and reinforcement, screed, plaster, painting, fence wall and gates, drainage, septic tank, borehole, generator); 43 of 63 lines priced from Adnario Market Rates, the rest (lump sums, sizes the card does not stock) for the QS | To compare your run against |

Steps: upload the model and run **Takeoff** (about 2 minutes); answer the review and accept the **Provisional** items
you want (what the model lacks but the job needs: the foundations, the work outside the building); **Generate BOQ**;
**Link to cost**; **Programme** → upload the programme PDF: its 207 rows become the programme (349 working days on
our calendar), the BOQ's work under its activities.
