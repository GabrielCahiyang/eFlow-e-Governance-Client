# Centered child-subitem creation — 30 October 2026

The Add child subitem action rendered its editor inline, stretching the task page. Creation now opens the existing form in the shared, centered modal with a close button, focus trapping and viewport scrolling. Root and nested child creation share this editor. Existing permissions, date constraints, staffing fields, request recovery and saving remain unchanged. Closing uses the existing unsaved-draft confirmation, and closing is blocked during saving.

Validation: 63 focused tests passed across nestedWorkRequestRecovery and nestedWorkCommandForms; TypeScript and the production build passed. The desktop browser scenario checks modal placement, keeping a draft after close, and retrying the same saved request without duplicate children. Its historical fixture clock is fixed to its October schedule so native date validation remains meaningful.

Desktop Chromium: passed. Screenshot: [Centered child-subitem dialog](screenshots/add-child-centered.png).
