# Person C: Dashboard, languages, report, repo and docs

## Your files (only you change these)
- Dashboard and report: `web/src/app/page.tsx`, `survey/`, `labels/`, `layout.tsx`, `globals.css`
- `web/src/components/`, `web/src/lib/i18n.tsx`, `web/src/messages/*.json`
- Project setup: `web/package.json`, `web/next.config.mjs`, `web/tsconfig.json`, `.github/`, `README.md`, `CONTRIBUTING.md`, `docs/WORKFLOW.md`, `test-data/`

## Day 1: you set up the repo for the team
1. Merge the three folders (see `START-HERE.md`) into the GitHub repo and push to `main`.
2. Settings: protect `main` (PR with 1 approval), add A and B as collaborators.
3. Create the labels and the first issues from the three `TASKS-*.md` files.
4. Everybody runs `git config commit.template .gitmessage`.

## Your tasks
1. **Sinhala and Tamil wording**: ask native speakers (ideally people who work in government offices) to review `si.json` and `ta.json`. The first version was written by an AI.
2. Print the report to PDF in all 3 languages. Check the Sinhala and Tamil letters show correctly and the signature block fits the page.
3. Test plan and a demo script for Thursday's rehearsal (leader + two phones, one of them offline). User guide in `docs/`.
4. Dashboard: sorting, photo preview, a clearer conflict view, the report layout.
5. Run the weekly review of issues and the Friday demo.

## Rules
- Branch names: `feat/<issue>-<short-name>`. Reviewer: **A reviews you**.
- You are the only one who changes `package.json`. If A or B needs a package, they open an issue.
- Never commit real data.
