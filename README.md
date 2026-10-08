# TALLYTAG

**TALLYTAG is an open-source tool for counting and checking an office's assets with phones: scan each asset's tag, record its condition, and see the full list update live, even without internet.**

> **Status:** starting. Built in the open by the Eastern Province IT Volunteer Programme, Sri Lanka.

---

## Why

Every year, government offices check that everything they own is still there and in working order: desks, computers, vehicles, equipment. In Sri Lanka this is the annual board of survey. Today it is done with paper lists, walking room to room, ticking items and writing notes, then typing everything up and chasing what is missing. It takes weeks, and the results are hard to trust.

TALLYTAG lets a team do it in hours, with the phones in their pockets.

## Why the name

For centuries, England's Exchequer kept its accounts on **tally sticks**: notched wooden sticks recording what was owed and paid, used from at least the twelfth century until 1826. Burning the old sticks in 1834 set the Houses of Parliament on fire. TALLYTAG keeps the tally of every asset tag, without the fire.

## How it works for the people using it

1. On a computer, the person leading the survey opens the survey for a building or office. A **QR code** appears.
2. **Each member of the survey team scans it with their phone** and joins the survey. Nothing to install.
3. In each room, they **scan the tag on each asset**, mark its condition (working, needs repair, unserviceable, missing), and take a photo if needed.
4. The **list on the computer updates live**: what has been found, what is still missing, and what needs attention.
5. **No signal in a room?** The phone keeps working and sends everything when the connection returns.
6. At the end, the leader reviews the results and produces the survey report.

## What it records

| For each asset | Example |
|---|---|
| Tag number | from the label on the asset |
| What it is | description and category |
| Where it is | building, floor, room |
| Condition | working, needs repair, unserviceable, missing |
| Photo | optional, for condition |
| Who checked it and when | the team member and the time |
| Notes | anything unusual |

Items found that are **not on the list** can be added on the spot, and items **on the list but not found** stand out at once.

## Languages

- **Sinhala, Tamil and English from the first release**, for every screen and every report.
- **Built to grow:** adding another language, or another kind of asset list or survey form, must not require changing the core.

## What it must do

**Must (first release)**
- Start a survey and let a team join from their phones with a QR code that expires.
- Scan asset tags with the phone's camera in the browser, or type the number when a tag is damaged.
- Record condition, notes and an optional photo for each asset.
- Keep working with no connection, and sync safely later, without losing or duplicating anything when two people check the same room.
- Show the live list on the computer: found, missing, extra, needing attention.
- Produce a clear survey report a person can check and sign.
- Be usable by anyone: large text, screen readers, clear contrast, one-handed use on a phone.

**Should**
- Print asset tags (QR labels) for items that have none.
- Load an existing asset list from a spreadsheet, and export the results to one.
- Compare this year's survey with last year's.

**Later**
- Connect to the province's asset register and other asset systems.
- Maps of each building, room by room.

## Built to be reused

TALLYTAG is a **reusable tool**: any office or organisation that counts what it owns, in any country, can use it, and other systems can add its scanning and survey features to their own. Its first use will be the Eastern Province's annual board of survey.

## Privacy and test data

- **Only test data is used in this project**: invented assets, test tags marked "TEST TAG" with numbers starting `TEST-`, and photos of everyday objects. No real asset lists, office layouts or official records are added to this repository.
- Photos of people are never taken or stored.

## Milestones

| Milestone | What is shown at the Friday demo |
|---|---|
| 1. Join and scan | QR on the computer, phones join, a test tag scanned and seen on the computer |
| 2. Record | Condition, notes and photo recorded; the live list updating |
| 3. Offline | A phone with no signal keeps working and syncs later without losing anything |
| 4. Report | The survey report, in all three languages; documentation |

## Contributing

Everyone is welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Pick an issue labelled `good first issue`, discuss your plan in the issue, then open a pull request. Every change is reviewed before it is merged.

## Licence

[Mozilla Public License 2.0](LICENSE).

---

*TALLYTAG is built by the Eastern Province IT Volunteer Programme, Sri Lanka.*
