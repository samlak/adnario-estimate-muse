# Adnario Market Rates

The rate card every firm starts with, copied from the app's system library. Both files are kept by hand; nothing is
looked up online. A firm edits its copy in the app (Rate cards).

## prices.json: materials, labour and plant

About 450 rows, one price each.

```json
{ "name": "225 mm block laying labour", "kind": "LABOUR", "unit": "m²", "price": 6000.0, "as_of": "2026-08-09", "note": "" }
```

| Field | Meaning |
|---|---|
| `name` | The price's name; work items refer to it by this name |
| `kind` | `MATERIAL`, `LABOUR` or `PLANT` |
| `unit` | Its unit (m², m³, bag, day, nr…) |
| `price` | Naira per unit |
| `as_of` | When the price was last checked |
| `note` | Anything to know about it |

## rates.json: work items with build-ups

About 285 items, each a BOQ-style piece of work with the recipe of its rate.

```json
{
  "code": "CEI-01", "section": "Ceilings", "description": "Flat gypsum-board suspended ceiling", "unit": "m²",
  "lines": [
    { "kind": "MATERIAL", "price": "12.5 mm gypsum ceiling board", "qty": 0.375 },
    { "kind": "LABOUR", "price": "Gypsum ceiling specialist labour", "qty": 1.0 }
  ],
  "additions": { "material": 0, "labour": 0, "risk": 5 }
}
```

| Field | Meaning |
|---|---|
| `code` | The item's library code; derived quantities (formwork, blinding, membrane, anti-termite) are priced by code from these |
| `section`, `description`, `unit` | What the AI matches a BOQ line against when linking to cost |
| `lines` | The build-up: a quantity of each price row (by its `name` in prices.json) per unit of the item; a `WORK` line is a quantity of another item (by its `rate` code), at that item's rate |
| `additions` | Percentages added: material fluctuation (on material lines), labour fluctuation (on labour lines), risk (on all) |

**A rate** = Σ(line quantity × its price) + the additions, + Σ(WORK quantity × that item's rate), rounded to the naira. A line whose price is missing leaves
the rate blank; nothing is guessed. Labour lines in days also give the item its output per gang-day.
