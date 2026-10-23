# Project setup redesign — 22 October 2026

Requested because the setup dialog was a long wall of repeated review text, with activation below the scroll area at desktop zoom.

- A compact progress ring and count introduce the next action.
- Separate icon shortcuts open dates and project people through the existing guarded destinations.
- Remaining checks appear as short icon rows. Plan, schedule and budget reviews each have clear **Review** and **Confirm** actions. Other checks show their actual server explanation.
- Confirmed checks stay in a counted disclosure. No authoritative check is omitted.
- Activation and **Done for now** sit in the shared modal's fixed footer, outside the scrollable content. The X, Escape, focus handling and pending-action lock use the existing modal/navigation foundation.
- The server still determines activation eligibility and rechecks it on confirmation. Governed projects continue through Proposal Context; no new authority or relaxed validation was added.
- Existing completion/settings callers keep the original readiness-panel presentation; the compact layout applies specifically to Project setup.

Implementation: `ProjectSetupDialog.tsx`, `ProjectReadinessPanel.tsx`, `SetupReadinessChecks.tsx`, `setupReadiness.css`. Desktop acceptance covers 1920×1080, 1366×768 and 1280×720, plus confirmation and disclosure behavior. Screenshots and completed check results are in the gallery/test receipts.

Live browser access reported disabled after the app restart. Earlier live small-task assignment evidence remains valid; the revised setup layout is verified with isolated desktop browser fixtures, not represented as a new hosted interaction.
