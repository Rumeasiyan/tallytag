# Person A: Backend and database (Go + PostgreSQL)

## Your files (only you change these)
- `server/` (all of it), `docker-compose.yml`
- `docs/API.md` (the contract; tell B and C before you change anything)
- `web/src/lib/api.ts` (the browser's API helper, it must match `docs/API.md`)

## First hour
1. Clone the repo, `docker compose up -d`, then `cd server && go run .` (needs Go 1.22+).
2. `go test ./...` should pass.
3. Open `docs/API.md` and read every endpoint. B and C depend on it.

## Your tasks
1. `server/Dockerfile`, and add the server to `docker-compose.yml`.
2. Tests against a real PostgreSQL: scan, duplicate id, two people conflict, expired join code, CSV import errors.
3. Rate limit `POST /join` (stop guessing of join codes). Document `ALLOWED_ORIGIN` for production.
4. Privacy: an endpoint or command to delete a finished survey and its photos.
5. Keep `docs/API.md` and `api.ts` in step with every change.

## Rules
- Branch names: `feat/<issue>-<short-name>`. Small PRs. Reviewer: **B reviews you**.
- Never commit real data or a real `.env`. Test tags start with `TEST-`.
- Need a UI change? Open an issue for the owner (B for phone screens, C for dashboard).
