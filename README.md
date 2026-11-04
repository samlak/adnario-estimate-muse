# Adnario Estimate

**A week of quantity surveying, done in under an hour.** Adnario Estimate turns a building's design model into a measured, priced Bill of Quantities, matches it to the contractor's programme of works and forecasts the cash flow month by month, with the architect, the quantity surveyor, the contractor and the client all working on the same project.

![Adnario AI answering a question about the Lekki Office Block, next to its BOQ and 3D model](docs/screenshots/ai.png)

## The problem

Every building starts with one question: *what will it cost?* In Nigeria and across emerging markets, the answer is still produced by hand. A quantity surveyor receives the architect's drawings and disappears for a week, measuring every wall, column, slab, door and window into a spreadsheet, wording each line the way their firm writes a Bill of Quantities, and pricing it from rates kept in yet another spreadsheet. It is slow, skilled and repetitive work, and it is thrown away the moment the design changes. A moved wall or an added floor, and much of that week starts again.

The cost then has to meet the calendar. The contractor's programme of works arrives as a separate PDF, and before anyone can say how much money is needed in March or what is being built in week 12, someone has to match its activities to the BOQ line by line. The client, who is paying for all of it, sees none of this until a document lands in their inbox. Every hand-over between architect, QS, contractor and client is a copy, a retype and a chance for the numbers to drift apart. Tenders go out late, estimates go out with gaps nobody noticed, and cost overruns are found on site, when they are most expensive to fix, instead of on the drawing board.

## What changes with Adnario Estimate

The QS uploads the design model and has a complete first draft in under an hour: every quantity measured, every line worded in the firm's style, every rate linked to the firm's rate card, the work placed under the contractor's programme, and a monthly cash flow. On the demo buildings, the whole chain from upload to cash flow runs in about ten minutes of machine time, so the QS's week goes into checking and judgement instead of counting and typing. Nothing is a black box. Click a BOQ line and its elements light up in the 3D model. Anything the system is unsure of becomes a review question for the QS, never a silent guess, and anything the design leaves out (excavation depth, hardcore, the fence, drainage, the septic tank) is proposed as a provisional item for the QS to accept or reject. When the design changes, the estimate updates instead of starting again.

## Why we built it

At Adnario we build project management software for construction, and our users kept asking for the same thing: bring estimating and pricing into one place, on the building model, so a project can follow a true BIM process and everyone can see it in 3D, 4D and 5D, meaning the design, the programme over time and the cost. Adnario Estimate is that place. Architects, quantity surveyors, contractors and clients each bring their own work (the model, the rates, the programme of works, the documents) and all see the same, up-to-date picture of what the project will cost and when.

## Built during the hackathon

All of Adnario Estimate, including every line of code in this repository, was built during the Meta Global AI Developer Hackathon (27 October to 4 November 2026). The git history starts on 2 November. Adnario's existing project management product is a separate codebase, and none of its code is used here. The sample building models are public IFC files, downloaded on first start. The projects, programmes, BOQs and the Adnario Market Rates card are our own demo data, made for this event.

## Try it

You need [Docker](https://www.docker.com) and a Meta Muse API key for the AI steps (the app and the demo data work without one).

```bash
git clone https://github.com/samlak/adnario-estimate-muse.git && cd adnario-estimate-muse
cp .env.example .env        # then set MUSE_API_KEY=<your Meta Muse API key>
docker compose up --build   # the first start downloads the sample models and loads the demo data (a few minutes)
```

The key stays in `.env` on the server, which git ignores, and is never sent to the browser or committed.

Open http://localhost:8000 and pick a demo account on the sign-in page. Every account's password is `demo-password`.

| Sign in as | To see |
|---|---|
| `qs@demo.adnario.app` (Quantity surveyor) | Everything: takeoff, BOQ, cost, programme, cash flow, Adnario AI |
| `architect@demo.adnario.app` (Contributor) | The models and the programme, without quantities or money |
| `client@demo.adnario.app` (Viewer) | The amounts and the cash flow, without the rate cards |
| `admin@demo.adnario.app` (Admin) | The team, invitations and the rate cards |

**About the demo:** two projects are already run and seeded, so you can see the finished result straight away. **Lekki Office Block** (three models: architecture, structure, electrical) has a priced BOQ, the contractor's programme and its cash flow, and **Ikeja Corporate Office** has an estimate with provisional items and a programme. To see it work live, open **Ikoyi Duplex**, which has only its model uploaded, and run the whole flow yourself: Takeoff, Generate BOQ, Link to cost, then upload its programme PDF from [`apps/api/app/database/seed/samples/ikoyi-duplex/`](apps/api/app/database/seed/samples/ikoyi-duplex).

`docker compose down` stops the app, and `docker compose down -v` also deletes its data, so the next start loads the demo again.

## One project, every party

- **Architects** upload their IFC models; a new export becomes the next version, compared with the last in 3D.
- **Quantity surveyors** run the takeoff, generate the BOQ, link it to cost and export it to Excel and PDF, with every quantity, description and rate editable.
- **Contractors and site teams** see the programme played as a 4D simulation over the model, without the money.
- **Clients** see the total, the priced bills and the cash flow, without the firm's rate cards.
- **Everyone** can comment on the project, an element, a BOQ line or a review question.

Each firm's data is kept apart, and every person sees only what their role allows.

## How it works

1. **Takeoff.** Upload the IFC models. Code reads every element and groups them into types, Muse decides how each type is billed, and code measures them. The model fills in as types are mapped, coloured by confidence. What cannot be measured is listed under Not measured, with the reason.
2. **Generate BOQ.** Muse groups and words the takeoff into bills and elements in the firm's style, and code checks the result.
3. **Link to cost.** Every firm starts with the Adnario Market Rates card: market prices for materials, labour and plant, and rates with full build-ups. The firm edits it or brings its own, and Muse links each BOQ line to the right item. Preliminaries, Contingency and VAT are added as percentages on the summary.
4. **Programme.** Upload the contractor's programme of works as a PDF. The app reads its activities, durations and links, works out the dates on a Nigerian working calendar with the critical path, and puts the BOQ's work under each activity. Play it as a 4D simulation over the model, or record it as a video.
5. **Cash flow.** Each activity's cost is spread over its working days into a monthly cash flow with an S-curve, exported to Excel.

When the architect sends a new model, **Update estimate** carries over every decision, rate and line the QS added, and only the new types go to Muse.

| Priced bills | Programme in 4D | Cash flow |
|---|---|---|
| ![The priced bills of the Lekki Office Block](docs/screenshots/cost.png) | ![The contractor's programme playing over the model](docs/screenshots/programme.png) | ![The monthly cash flow with its S-curve](docs/screenshots/cash-flow.png) |

## How Meta Muse powers it

Adnario Estimate runs on **Meta Muse Spark** (`muse-spark-1.3`), called on Meta's Model API. Muse is not a chatbot bolted on the side. It does the judgement a QS would otherwise do by hand, at seven points in the flow, and code checks every answer before the app uses it:

1. **Reads the building.** Muse reads a summary of the models and the client's documents (briefs, specifications, PDFs) and writes a short description of the project and the facts that matter for the estimate, such as the city and the specification.
2. **Decides how each element is billed.** For every type of element in the model, Muse chooses the BOQ item, section, unit and measuring method under Nigerian practice (BESMM4R). It sees a compact catalogue of types, never the model file, and never computes a quantity.
3. **Asks instead of guessing.** Muse writes the review questions where the model is unclear and proposes provisional items for work the design does not show.
4. **Writes the BOQ in the firm's voice.** Muse groups the measured lines into bills and elements and words them in the firm's house style. Code then checks that every line is used once, the units agree and the quantities add up.
5. **Links each line to a rate.** Muse picks the item on the firm's rate card that is the same work. Code checks the unit, material and size before the rate is used, and with no true match the rate stays blank for the QS.
6. **Places the BOQ's work under the programme.** Code reads the contractor's programme PDF, keeping the activities, names, durations and links exactly as the contractor wrote them. Muse then decides which activity does each piece of measured work (the ground floor slab's reinforcement, formwork and concrete, say), so the programme can play over the model and the cost can be spread over time. Code checks every assignment.
7. **Answers questions as an agent.** **Adnario AI**, in the corner of every project, is a multi-agent assistant: an orchestrator that plans the answer and hands parts of it to model, cost and programme specialists, each with its own read-only look-ups. Ask "What is the total cost, which bill is the biggest, and which month needs the most money?" and it gathers the figures, answers, and links each part back to the panel it came from.

The rule throughout is **code measures, AI interprets**. Quantities come from the geometry and quantity sets in the model, worked out by code ([IfcOpenShell](https://ifcopenshell.org)), and every BOQ number traces back to the model elements it came from. The system never invents a price or a duration: rates come from the firm's own rate card or the QS, and the programme is always the contractor's own.

## How it's implemented

- **Web app** (React, Vite, Tailwind, with xeokit for the 3D viewer) talks only to the API: requests over HTTP, and live progress and changes streamed back over Server-Sent Events, so every open browser on a project updates without a refresh.
- **API** (FastAPI, Python) does the work. It reads and measures the IFC models with IfcOpenShell, runs the estimate, the BOQ, pricing, the programme and the cash flow, and writes the Excel and PDF exports. Long work, such as a takeoff run, runs as a server task that keeps its progress, so a page that reloads picks up where it was.
- **Converter** (a small Node service) turns each uploaded IFC model into XKT, the format the 3D viewer loads fast. Only the API calls it.
- **PostgreSQL** holds every firm's data, kept apart by row-level security, so one firm can never read another's projects.
- **Muse** is called only from the API, from one module (`apps/api/app/core/llm.py`), on Meta's Model API through LangChain. Adnario AI's orchestrator and specialists are a LangGraph graph. The steps that shape the estimate ask Muse for JSON, and code validates it before anything is saved. The Muse API key never leaves the server.

## Develop

To work on the code with live reload you need Docker (for the database), [Node.js](https://nodejs.org) 20+ and [uv](https://docs.astral.sh/uv/).

```bash
npm run dev           # installs on the first run, then starts the database, API, converter and web app together
npm test              # unit tests, no database or AI needed
npm run e2e           # the full flow in a browser, with real calls to Muse
```

## Built with

React, Vite and Tailwind for the web app; FastAPI and PostgreSQL for the API; IfcOpenShell to read and measure the models; xeokit for the 3D viewer; LangChain, LangGraph and Meta Muse Spark for the AI.
