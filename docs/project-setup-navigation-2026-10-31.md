# Project setup navigation — October 31, 2026

- The project setup/create modal keeps a 900px desktop height, capped to the viewport minus 32px, and its existing large width. Header, steps and footer remain outside the scrolling content area. Its dimensions no longer change between sections.
- Details, Scope, Lead & dates, Funding and Review are actual keyboard-accessible buttons. Users may jump directly to any section without filling earlier sections. Active writes and uncertain funding submissions temporarily lock navigation.
- Draft details remain in the wizard. The funding panel remains mounted while hidden, preserving unsaved funding rows and their retry identity when visiting other sections.
- Funding authorization still requires saved project details. When needed, Funding offers **Save details and load funding**; navigating to that section itself does not create an empty project or bypass financial validation.
- Finish setup validates title, description, scope, project lead, dates and authorized funding or an explicit no-funding choice. Unsaved/uncertain funding must be resolved first. Existing server checks remain authoritative.
- Setup & activation now includes a **Project details and funding** check from the canonical project snapshot. Its Activate button is disabled until setup is complete, even if the other plan reviews have passed. Missing fields are listed. Governed proposal workflows retain their separate checks.
- The installed activation RPC already requires `eflow_project.ready`, so no database migration or permission change was necessary.

Focused verification: 11 tests passed in `projectDefinitionFlow.test.tsx` and `projectSetupActivationGuard.test.ts`. These cover direct section navigation, draft persistence, required fields, explicit no-funding selection, unfinished setup and governed workflow compatibility. TypeScript and the production build passed (existing chunk-size warning only). Browser layout verification remains with the user.
