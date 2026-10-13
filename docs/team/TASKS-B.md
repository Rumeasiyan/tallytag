# Person B: Phone app and offline

## Your files (only you change these)
- `web/src/app/scan/page.tsx`, `web/src/app/join/[token]/page.tsx`
- `web/src/lib/offline.ts` (the offline queue and sync), `web/src/lib/session.ts`
- `web/public/` (`sw.js`, `manifest.json`, `icon.svg`)

## First hour
1. Clone the repo. Start the database and server (see README, "Run it on your computer"), then `cd web && npm install && npm run dev:https`.
2. Open the dashboard on a computer, scan the join QR with your phone, record a test tag.
3. Read `docs/API.md` (sections "Recording" and "Photos").

## Your tasks
1. Test on a **real Android phone and a real iPhone**: HTTPS, camera scan, photo, airplane mode, reconnect. Write every bug as an issue.
2. Test the offline reload in a production build (`npm run build && npm start`): does `/scan` open with no signal?
3. One-hand use: bigger targets where needed, a clear "Scan next" flow, a warning when a tag is not on the list.
4. Screen reader pass (TalkBack and VoiceOver) on the scan screen.
5. Handle the case where the join code is expired or the session is lost (clear message, easy way back).

## Rules
- New text on screen goes through `t("...")`. Add keys to `web/src/messages/en.json`, `si.json`, `ta.json` (C owns those files: add only new lines, and if Git shows a conflict keep both sides). Ask C to check the Sinhala and Tamil wording.
- Branch names: `feat/<issue>-<short-name>`. Reviewer: **C reviews you**.
- Never commit real data.
