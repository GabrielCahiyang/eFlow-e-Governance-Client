# Project and finance QA evidence

All evidence in this folder belongs to the eFlow repository. The gallery references the screenshots here directly; it does not depend on temporary chat attachments or externally hosted images.

## Start here

- [REPORT.md — full audit and remaining gaps](REPORT.md): final workflow results, 14 fixes, budget reconciliation, validation receipts, remaining improvements and untested branches.
- [GALLERY.html — all 45 screenshots](GALLERY.html): expandable, numbered walkthrough with captions.
- [AUDIT.md — detailed chronology](AUDIT.md): actions and findings recorded during the walkthrough.

## Included evidence

- **45 browser screenshots:** numbered `01-` through `45-`, stored as `.jpg` files.
- **Hosted verification:** `hosted-proof.json` and `security-advisors.json`.
- **Validation logs:** unit tests, browser regressions, TypeScript, production build and Graphify. These logs are explicitly retained by the repository's ignore rules.
- **Labeled test fixtures:** `QA-receipt-400.png` and `QA-work-evidence.txt`.
- **Gallery generator:** `build-gallery.mjs`; run `node docs/live-financial-workflow-2026-10-21/build-gallery.mjs` from the repository root to rebuild the gallery.

Open `GALLERY.html` directly, or use `/docs/live-financial-workflow-2026-10-21/GALLERY.html` while the eFlow development server is running. The Markdown report's screenshot and evidence links are relative to this folder, so keep the folder together when copying it.

The records and receipt are QA fixtures. Coverage limits and the preserved pre-fix journal date are documented in REPORT.md.
