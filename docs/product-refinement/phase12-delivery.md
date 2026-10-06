# Phase 12 — Project Views and Shared Inspector delivery

Implemented locally on 6 October 2026. Changes remain uncommitted and unpushed.

Main Table, Board, Gantt, Calendar, Dashboard and Offices now share date-range filters and scoped task/fact/financial context, with personal filter, Gantt scale and Calendar mode preferences. Office drill-down applies its filter and table navigation together.

The new task-inspector feature composes the existing domain sections through public APIs. It protects explicit drafts on close, section/task/project navigation, retains failed saves, rejects stale team membership, distinguishes loading errors from empty records, and explains unavailable tasks. Team and schedule changes use shared impact dialogs; start/resume failures stay in the panel. Board keeps its non-drag lifecycle actions and review safeguards. Schedule patches preserve recorded timestamp suffixes. Rich evidence notes use sanitized display.

The inspector reuses project Office context, isolates outside-project realtime subscriptions, and restores focus to original or refreshed task controls. Nested team dialogs capture their opener before child autofocus; denial explanations wrap and mobile actions remain reachable. Existing navigation destinations, services, review readiness, financial authority and the old drawer compatibility exports are retained.

Shared-project Task Lead team mutation remains gated by **G2**; this UI phase does not alter that backend authority. No schemas, RLS policies, Python endpoints, API payloads or existing public service return values changed. Moderation still requires an audit reason and preserves history.

## Validation

| Check | Result |
| --- | --- |
| TypeScript | `npm run check` passed. |
| Unit/regression | `npm test`: 708 tests in 181 files passed. |
| Production build | `npm run build` passed with existing bundle-size warnings. |
| Live frontend | 23 Chromium cases passed on live port 5173, including all 9 new inspector cases. Both view cases passed again after capture timing was stabilized. |
| Graphify | Updated: 7,159 nodes / 22,109 edges; six existing partial-extraction warnings retained. |
| Whitespace | `git diff --check` passed. |

Browser checks use the real frontend at `http://127.0.0.1:5173` with synthetic intercepted auth/REST/gateway/realtime responses. They do not certify deployed RLS. Native zoom and assistive-technology sessions were not run.

Diagnostic checks caught Calendar source-element rebuilding, inspector tab Escape handling, duplicate Office realtime subscriptions, nested dialog autofocus, and a truncated mobile denial explanation. These were corrected. One mobile team fixture initially intercepted a direct task PATCH instead of the existing assignment RPC; its denial interceptor now targets `assign_task_with_details`. Diagnostic receipts are separate from passing verification.

See the [context and inspector compatibility contract](phase12-context-inspector-contract.md), [source snapshots](phase12-evidence/source-manifest.json) and [final evidence manifest](phase12-evidence/evidence.json). Prior phase captures and receipts are preserved; Phase 11 evidence provides historical context. No pristine Phase 12 before-state was captured. Final Gantt/Calendar captures wait for confirmation removal to avoid recording a closing animation. Next planned UI phase: [Phase 13 My Work and Inbox / Action Center](phase-13-my-work-inbox.md).
