# Adnario Estimate

**A week of quantity surveying, done in under an hour.** Adnario Estimate turns a building's design model into a measured, priced Bill of Quantities, matches it to the contractor's programme of works and forecasts the cash flow month by month, with the architect, the quantity surveyor, the contractor and the client all working on the same project.

![Adnario AI answering a question about the Lekki Office Block, next to its BOQ and 3D model](docs/screenshots/ai.png)

## The problem

Every building starts with one question: *what will it cost?* In Nigeria and across emerging markets, the answer is still produced by hand. A quantity surveyor receives the architect's drawings and disappears for a week, measuring every wall, column, slab, door and window into a spreadsheet, wording each line the way their firm writes a Bill of Quantities, and pricing it from rates kept in yet another spreadsheet. It is slow, skilled and repetitive work, and it is thrown away the moment the design changes. A moved wall or an added floor, and much of that week starts again.

The cost then has to meet the calendar. The contractor's programme of works arrives as a separate PDF, and before anyone can say how much money is needed in March or what is being built in week 12, someone has to match its activities to the BOQ line by line. The client, who is paying for all of it, sees none of this until a document lands in their inbox. Every hand-over between architect, QS, contractor and client is a copy, a retype and a chance for the numbers to drift apart. Tenders go out late, estimates go out with gaps nobody noticed, and cost overruns are found on site, when they are most expensive to fix, instead of on the drawing board.

## What changes with Adnario Estimate

The QS uploads the design model and has a complete first draft in under an hour: every quantity measured, every line worded in the firm's style, every rate linked to the firm's rate card, the work placed under the contractor's programme, and a monthly cash flow. On the demo buildings, the whole chain from upload to cash flow runs in about ten minutes of machine time, so the QS's week goes into checking and judgement instead of counting and typing. Nothing is a black box. Click a BOQ line and its elements light up in the 3D model. Anything the system is unsure of becomes a review question for the QS, never a silent guess, and anything the design leaves out (excavation depth, hardcore, the fence, drainage, the septic tank) is proposed as a provisional item for the QS to accept or reject. When the design changes, the estimate updates instead of starting again.

## Why we built it

At Adnario we build project management software for construction, and in every conversation with firms and organisations in the industry we heard the same request: bring estimating and pricing into one place, on the building model, so a project can follow a true BIM process and everyone can see it in 3D, 4D and 5D, meaning the design, the programme over time and the cost. Adnario Estimate is that place. Architects, quantity surveyors, contractors and clients each bring their own work (the model, the rates, the programme of works, the documents) and all see the same, up-to-date picture of what the project will cost and when.

## Built during the hackathon

All the code in this repository was built during this hackathon. Adnario's existing project management product is a separate codebase and is not connected to this one. The Adnario Market Rates card that every firm starts from is built from Nigerian market data on materials, labour and plant that we had already collected, so the prices in the demo reflect what building really costs.

## Try it

You need [Docker](https://www.docker.com) and a Meta Muse API key for the AI steps (the app and the demo data work without one).

```bash
git clone https://github.com/samlak/adnario-estimate-muse.git && cd adnario-estimate-muse
cp .env.example .env        # then set MUSE_API_KEY=<your Meta Muse API key>
docker compose up --build   # the first start downloads the sample models and loads the demo data (a few minutes)
```

Open http://localhost:8000 and pick a demo account on the sign-in page. Every account's password is `demo-password`.

| Sign in as | To see |
|---|---|
| `qs@demo.adnario.app` (Quantity surveyor) | Everything: takeoff, BOQ, cost, programme, cash flow, Adnario AI |
| `architect@demo.adnario.app` (Contributor) | The models and the programme, without quantities or money |
| `client@demo.adnario.app` (Viewer) | The amounts and the cash flow, without the rate cards |
| `admin@demo.adnario.app` (Admin) | The team, invitations and the rate cards |

**About the demo:** two projects are already run and seeded, so you can see the finished result straight away. **Lekki Office Block** (three models: architecture, structure, electrical) has a priced BOQ, the contractor's programme and its cash flow, and **Ikeja Corporate Office** has an estimate with provisional items and a programme. To see it work live, open **Ikoyi Duplex**, which has only its model uploaded, and run the whole flow yourself: Takeoff, Generate BOQ, Link to cost, then upload its programme PDF from [`apps/api/app/database/seed/samples/ikoyi-duplex/`](apps/api/app/database/seed/samples/ikoyi-duplex).

`docker compose down` stops the app, and `docker compose down -v` also deletes its data, so the next start loads the demo again.

## How it works

1. **Takeoff.** Upload the IFC models. The app measures every element and fills in the 3D model as it goes, coloured by confidence. What cannot be measured is listed under Not measured, with the reason.
2. **Generate BOQ.** The takeoff becomes bills and elements, worded in the firm's style.
3. **Link to cost.** Each BOQ line is linked to the firm's rate card. Every firm starts with Adnario Market Rates (market prices for materials, labour and plant, and rates with full build-ups), and edits it or brings its own. Preliminaries, Contingency and VAT are added as percentages on the summary.
4. **Programme.** Upload the contractor's programme of works as a PDF. The app reads its activities, works out the dates on a Nigerian working calendar with the critical path, and puts the BOQ's work under each activity. Play it as a 4D simulation over the model, or record it as a video.
5. **Cash flow.** Each activity's cost is spread over its working days into a monthly cash flow with an S-curve, exported to Excel.

The architect, QS, contractor and client all work on the same project, each seeing only what their role allows, and anyone can comment on an element, a BOQ line or a review question. When the architect sends a new model, **Update estimate** carries over every decision, rate and line the QS added.

| Priced bills | Programme in 4D | Cash flow |
|---|---|---|
| ![The priced bills of the Lekki Office Block](docs/screenshots/cost.png) | ![The contractor's programme playing over the model](docs/screenshots/programme.png) | ![The monthly cash flow with its S-curve](docs/screenshots/cash-flow.png) |

## How Meta Muse powers it

Adnario Estimate runs on **Meta Muse Spark** (`muse-spark-1.3`) on Meta's Model API. Muse is not a chatbot bolted on the side. It does the judgement a QS would otherwise do by hand, in two ways: as a set of steps inside the estimate pipeline, and as Adnario AI, an agent that answers questions about the whole project.

The rule throughout is **code measures, AI interprets**. Quantities come from the geometry and quantity sets in the model, worked out by code ([IfcOpenShell](https://ifcopenshell.org)), and every BOQ number traces back to the model elements it came from. Muse decides what things *are* and how they are billed; it never computes a quantity, invents a price or sets a duration. Every answer it gives is checked by code before the app uses it.

### The estimate pipeline

1. **Reads the building.** Muse reads a summary of the models and the client's documents (briefs, specifications, PDFs) and writes a short description of the project and the facts that matter for the estimate, such as the city and the specification. Every later step is given this context.
2. **Decides how each element is billed.** Code groups the model's elements into types and sends Muse a compact catalogue of them (class, name, material, layers, size, count), never the model file. For every type, Muse chooses the BOQ item, section, unit and measuring method under Nigerian practice (BESMM4R). The catalogue goes in batches, several at once, and code measures each batch the moment its answer arrives, which is why the 3D model fills in live. Confidence is code's, not the model's: it comes from checks anyone can repeat, and a low-confidence mapping is held for the QS instead of billed.
3. **Asks instead of guessing.** Muse reviews the whole draft (the measured lines, the types held back and the types left out) alongside the questions code has already raised. It writes the review questions a QS would ask and proposes provisional items for work the design does not show, such as excavation, hardcore, drainage or the fence. Code then measures each provisional item from what it says it is based on.
4. **Writes the BOQ in the firm's voice.** Muse groups the measured lines into bills and elements and words them in the firm's house style. Code then checks that every line is used once, the units agree and the quantities add up.
5. **Links each line to a rate.** Muse picks the item on the firm's rate card that is the same work. Code checks the unit, material and size before the rate is used, and with no true match the rate stays blank for the QS.
6. **Places the BOQ's work under the programme.** Code reads the contractor's programme PDF, keeping the activities, names, durations and links exactly as the contractor wrote them. Muse decides which activity does each piece of measured work (the ground floor slab's reinforcement, formwork and concrete, say). Code checks every assignment, and any answer that names an activity not in the programme is sent back to Muse to try again.

Each step asks Muse for a structured JSON answer. If the answer is not valid, Muse is asked again with the error. When a new model version arrives, only the types Muse has not seen before are sent, and every earlier decision is kept.

### Adnario AI, the agent

In the corner of every project, **Adnario AI** answers questions about the estimate, the programme and the cash flow, such as *"What is the total cost, which bill is the biggest, and which month needs the most money?"*

- **An orchestrator with specialists.** A Muse orchestrator plans the answer and hands parts of it to three Muse specialists, for the model and takeoff, the cost and the programme. Each has its own set of read-only look-ups.
- **Answers from the data, not from memory.** More than a dozen look-ups (the BOQ totals, a single BOQ line, elements by storey, the activities in a given week, the cash flow by month, and more) are worked out by code from the project's own estimate. Independent look-ups run side by side, and the agent takes up to ten rounds to reach an answer.
- **Shows its work.** The answer streams in, each look-up it used is listed under it ("Worked: 2 look-ups, 7 s"), and the answer links to the panels its figures came from.
- **Respects roles.** An architect asking about the project gets no quantities or money: the cost specialist and the money look-ups are not available to them.

### How it's implemented

Every call to Muse goes through one module on the server ([`apps/api/app/core/llm.py`](apps/api/app/core/llm.py)), using LangChain's client for the Chat Completions format that Meta's Model API speaks. Adnario AI's orchestrator and specialists are a LangGraph graph. The Muse API key is read from `.env` on the server and never reaches the browser.

Around the AI, the web app (React, with xeokit for the 3D viewer) talks to a FastAPI server that measures the models with IfcOpenShell and stores each firm's data in PostgreSQL, kept apart by row-level security. A small Node service converts each IFC model for the viewer. Long work, such as a takeoff run, streams its progress to the browser as it happens.

## Develop

To work on the code with live reload you need Docker (for the database), [Node.js](https://nodejs.org) 20+ and [uv](https://docs.astral.sh/uv/).

```bash
npm run dev           # installs on the first run, then starts the database, API, converter and web app together
npm test              # unit tests, no database or AI needed
npm run e2e           # the full flow in a browser, with real calls to Muse
```
