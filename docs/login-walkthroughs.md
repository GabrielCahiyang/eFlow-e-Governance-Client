# Login workflow previews

Both login walkthroughs render the existing eFlow application, tabs and dialogs.
They do not contain screenshot slides or copies of those screens.

## Rendering

`walkthrough.html` is a second Vite entry. Its small bootstrap installs sample
records before importing the same `App` used by the main application. Scene
preparation navigates to the real route and opens its existing controls.
The player scales this document into its viewport, keeping the actual desktop
layout intact. Scene captions, autoplay, pause, replay, chapter selection,
timeline seeking and optional narration remain in the outer player. Playback
time starts only after the scene is ready.

The application code and assets are shared by the two build entries and cached
by the browser. Opening the login page does not load an authenticated workspace;
the separate preview entry loads only when a walkthrough is opened.

## Isolation

Each preview owns memory-only local/session storage, sample authentication and
sample API responses. It disables auth broadcasting, beacons and real realtime
sockets. Unknown backend requests are refused. A content security policy also
blocks network connections. The preview is inert; viewers use the player
controls rather than submitting forms. Closing it discards its sample session
without changing the surrounding login form or account storage.

Sample records are maintained in
`src/app/features/authentication/workflow-preview/sandbox/`.
Production services, permissions, database policies and endpoints are unchanged.
When a real control or API contract changes, update scene preparation or sample
responses instead of reproducing its UI in the guide.

## Example

The funded example uses a ₱100,000 Supplies account, reserves ₱40,000 for a
project and allocates ₱10,000 to its task. The team requests ₱4,000, submits
₱3,500 actual spending and returns ₱500 cash. After settlement, the Head returns
₱6,500 unused task funding plus ₱30,000 unallocated project funding before
completion. The outside-office guide also opens the real named-office,
invitation, acceptance and task-team controls for project-only participation.

## Checks

- `npm run check`
- `npm test -- tests/unit/loginWorkflowPreview.test.tsx tests/unit/startupImportBoundary.test.ts`
- `npm run build`
- `EFLOW_E2E=1 EFLOW_E2E_BASE_URL=<preview-url> npx playwright test tests/e2e/login-workflow-preview.spec.ts --project=chromium`

The browser checks exercise every scene and both player layouts, check parent
storage preservation and verify that the sample screens make no Supabase
network requests. These checks validate the guide, not the live financial or
invitation workflow.

Verified on November 9, 2026: typecheck and production build passed; all 8 focused
unit tests and all 9 Chromium checks passed. The latter also checks the login
loader and sign-in availability when a walkthrough module cannot download.
