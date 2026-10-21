# Import receipt and project modal fixes — 21 October 2026

- Import success previously raced with an outstanding 25-second keep-alive request. Completion closes the import lease, causing that late request to reject. The hook now stops the interval at publication, ignores late keep-alive failures after the receipt, and clears earlier transient errors. A committed receipt is rendered without the failure/retry banner.
- Selected contributors now use compact Lucide X buttons inside flex-aligned chips. Accessible per-person remove labels, capability checks, removal confirmation and save behavior are unchanged.
- Project setup uses the shared centered Vibe modal, including its close X, focus trap, Escape, scrolling and guarded navigation. The former inline section no longer occupies the project header's flex row. Header utilities can wrap without crushing the title.
- Active projects no longer show Setup & activation. Completion requirements and other project actions remain available through their existing permissions.

Validation: 55 focused unit cases across import recovery, import rendering, canonical staffing and project lifecycle passed. Type checking passed. Two Chromium desktop tests passed: setup modal bounds at 1920×1080, 1366×768 and 1280×720; close X and Escape; absence after activation; and contributor remove controls contained by their chips with working local removal. Browser records use intercepted synthetic data; no project writes or emails were sent.

An initial resource-constrained browser run timed out while loading after refresh and used an incorrect accessible locator for the people button. The corrected fresh run passed. The in-app browser separately reported disabled browser access; the desktop Playwright verification did not depend on it.

Production build passed (1m 34s), with the existing large-chunk warnings. No schema, RLS, public API or server changes were needed.

Screenshots: [Project setup](setup-desktop.png), [contributor chips](contributors-desktop.png).
