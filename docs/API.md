# TALLYTAG API

The contract between the Go server, the phone screens and the dashboard. Change it only through an issue, and tell the whole team.

## Conventions

- Base URL `/api/v1`. Bodies are JSON unless said otherwise. Keys are `camelCase`. Times are ISO 8601 in UTC.
- Every check and photo gets an **id made on the phone (UUID v4)**. A phone can create records offline and send them later; sending the same id twice never creates two rows.
- Tag numbers are matched ignoring case and surrounding or inner spaces (`test-0007 ` = `TEST-0007`).
- Test data only: tags start with `TEST-`.
- In development the Next.js server forwards `/api/*` to the Go server, so phones only need the Next.js address.

### Authentication

| Who | Gets it from | Sent as |
|---|---|---|
| Leader (computer) | `POST /surveys` → `leaderToken` (`lt_…`) | `Authorization: Bearer <token>` |
| Member (phone) | `POST /join` → `memberToken` (`mt_…`) | `Authorization: Bearer <token>` |

`EventSource` and `<a href>` cannot set headers, so `live` and `photos/{id}` also accept `?token=<token>`.

### Errors

```json
{ "error": { "code": "join_token_expired", "message": "This QR code has expired." } }
```

The screens translate by `code` (`err.<code>` in `web/src/messages/*.json`). Statuses: 400 bad request, 401 not signed in, 404 not found, 410 join code expired.

### Values

- Condition: `working` · `needs_repair` · `unserviceable` · `missing`
- Item status: `found` (on the list and checked, not recorded missing) · `missing` (on the list, not checked yet or recorded missing) · `extra` (checked but not on the list)
- `conflict: true` when two or more checks of the same tag recorded different conditions. The **latest `scannedAt` wins** for the shown condition; older checks are kept.

## Endpoints

### Surveys and joining

| Method and path | Who | Purpose |
|---|---|---|
| `POST /surveys` | anyone | Create a survey. Body `{ name, building }`. → `201 { surveyId, leaderToken, joinToken, joinExpiresAt }` |
| `GET /surveys/{id}` | leader | → `{ surveyId, name, building, joinToken, joinExpiresAt, createdAt, members[] }` |
| `POST /surveys/{id}/join-token` | leader | New QR code (the old one stops working). → `{ joinToken, joinExpiresAt }` |
| `POST /join` | anyone | Body `{ joinToken, name }`. → `201 { memberId, memberToken, surveyId, surveyName }`. Errors `join_token_not_found` (404), `join_token_expired` (410) |

The QR code holds `<site address>/join/<joinToken>`. The code expires after `JOIN_TOKEN_TTL` (default 10 minutes).

### Recording

`POST /scans` (member)

```json
{ "id": "d2b8f0c4-71aa-4e0b-bb0c-92f61f0f6e11", "tagNumber": "TEST-0007", "condition": "working",
  "notes": "", "room": "Room 2", "photoId": "c1111111-71aa-4e0b-bb0c-92f61f0f6e11", "scannedAt": "2026-10-09T08:31:12Z" }
```

`notes`, `room`, `photoId`, `scannedAt` are optional. → `201` (`result: "created"`) or `200` (`result: "duplicate"`):

```json
{ "id": "d2b8…", "result": "created", "item": { "tagNumber": "TEST-0007", "status": "found", "condition": "working", "…": "see Item below" } }
```

`POST /scans/batch` (member): how a phone sends what it collected offline. Body `{ "scans": [ …up to 500 scans as above… ] }`. → `200 { "results": [ { id, result: "created" | "duplicate" | "error", error? } ] }`. One bad scan does not stop the others. Remove a record from the phone queue when its result is `created` or `duplicate`.

`POST /photos?id=<uuid>` (member): raw JPEG, PNG, WebP or GIF bytes, up to 8 MB, `Content-Type` the image type. → `201 { photoId }`. Send the photo **before** the scan that uses it. Same `id` again is ignored.
`GET /photos/{id}` (leader or member of that survey): the image.

### The list

`GET /surveys/{id}/items` (leader) → `{ counts, items[] }`

```json
{ "counts": { "total": 52, "found": 12, "missing": 38, "extra": 2, "needsAttention": 3, "conflicts": 1 },
  "items": [ { "tagNumber": "TEST-0007", "description": "TEST Projector", "category": "IT Equipment",
               "building": "TEST Building A", "floor": "1", "room": "Room 2",
               "status": "found", "condition": "working", "notes": "", "photoId": null,
               "checkedBy": "Member One", "checkedAt": "2026-10-09T08:31:12Z", "conflict": false, "onList": true } ] }
```

`needsAttention` counts items whose condition is `needs_repair`, `unserviceable` or `missing`.

`POST /surveys/{id}/assets` (leader): body is a CSV (`Content-Type: text/csv`, up to 5 MB) with a header row. Required column `tag_number`; optional `description`, `category`, `building`, `floor`, `room`. Existing tags are updated. Add `?mode=replace` to clear the list first. → `{ imported }`.

`GET /surveys/{id}/export.csv` (leader): results as CSV (UTF-8 with BOM so Excel reads Sinhala and Tamil; cells that start with `= + - @` are escaped).

`GET /surveys/{id}/report` (leader) → `{ survey, generatedAt, counts, items[], members[] }`, everything the printed report needs.

### Live updates

`GET /surveys/{id}/live?token=<leaderToken>` is a Server-Sent Events stream (`text/event-stream`). Each event is `data: <json>`:

```json
{ "type": "member.joined", "member": { "memberId": "…", "name": "Member One" } }
{ "type": "scan.recorded", "item": { "…": "Item" } }
{ "type": "assets.imported", "count": 50 }
```

After a reconnect the dashboard reads `GET /items` once to catch up, then keeps listening.

`GET /health` → `{ "status": "ok" }` (no `/api/v1` prefix).
