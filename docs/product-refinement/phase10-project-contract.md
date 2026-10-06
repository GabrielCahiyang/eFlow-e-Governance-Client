# Phase 10 project workspace contract

Implemented on the existing Phase 9 checkout. This document records the UI changes separately from the historical Phase 10 implementation plan and prior Phase 6.5/8A/8B/9 work.

## Identity and discovery

Every project view shares one header: project title, Office and owner labels, lifecycle and schedule text, task progress, loaded participants, actual readiness checks, personal favorite, Invite / share and Project actions. Missing identity stays explicit. Completed and archived project metadata is read-only. Title editing retains inline blur/Enter autosave and shows saving, success or a retained error.

Main table, Board, Gantt, Calendar, Project Dashboard and Offices are permanent views. Add view also opens these core views. Overview and Timeline move to contextual views alongside Readiness & closeout, Reports, Proposal Context, Activity, Reviews, Workload & Team, Budget Overview, Approval Status, Evidence Register and Decision History. No project tool is retired. Proposal/budget discovery retains its existing conditions.

Existing `/projects?page=Projects&project=<id>&view=<view>` links, project switching, shared filters, task drawer and browser history retain their controllers. Legacy view aliases resolve in the catalog: plan/delivery → timeline; work/main_table/main-table → tasks; people/team → workload; proposal-context → proposal_context. Unknown views fall back through the existing initial view. The project-scoped optional-view key remains `eflow_project_views_<projectId>`; former optional Board/Dashboard/Offices values are removed from the optional list because those views are permanently visible. Unknown and malformed local values are ignored. The selected optional view remains discoverable, including through overflow. Existing creation and first-column task actions remain available.

## Utilities, settings and authority

Favorites use the existing Phase 9 user/Office-scoped local navigation preferences, synchronized between the header and sidebar. They store authorized project IDs, not project records, and do not introduce shared or cross-device persistence. Logout keeps its existing preference cleanup.

Invite / share offers the current project-view link and opens existing Project Offices participation tools. Copying a link grants no access. Clipboard failure leaves a selectable link and a keyboard-copy instruction. Invitations and staff selection retain their existing Office-specific workflows.

Project settings edits only existing title, description, priority, start date and target date through `updateProject`. The dialog sends only changed fields, requires a nonblank title and validates target date against start date. It does not patch lifecycle status, ownership or access. Read-only roles and closed projects can inspect settings without Save controls. Failure retains drafts and server messages; retry repeats the settings operation. An in-flight ref prevents duplicate submissions and navigation during a save.

Project actions adapts the existing parent-controlled completion, archive/restore and deletion dialogs. The header offers lifecycle actions only when its existing project-management rule and parent capabilities both permit them; the existing sidebar entries remain available under their original rules. Archive explains the completion prerequisite. Deletion retains typed-title/reason confirmation and the existing retained-task/audit-history impact. Server validation remains authoritative.

No Phase 10 schema, RLS, Python endpoint, API payload or public service-return changes. The local Office identity correction from Phase 6.5 remains intact. G2's shared-project Task Lead staffing restriction is unchanged; this UI does not grant new execution or cross-Office staffing powers. Admin platform oversight does not gain project-management authority from participant labels or utilities.

## State and navigation boundaries

The shared readiness snapshot calls the existing read-only readiness RPC, reports stage and confirmed checks, and links to the full readiness panel. It retries readiness alone after failure. Project/task/Office context changes refresh the snapshot; the full panel shares refreshed results. Request versions prevent responses for a previous project, or an older header request, from replacing newer results. Backend readiness checks, activation and closeout rules are unchanged.

Participants reuse loaded project/Office membership and task contributors, with deduplicated IDs and explicit missing names. Office loading failure has a scoped retry. Existing member, milestone and audit query services return empty arrays on some failures; their public contracts are preserved, so the new header cannot claim to distinguish every empty response from a failed request. Workflow-fact errors retry that subscription alone; there is no broad reset disguised as Retry.

Explicit-save settings, completion/archive/restore/deletion notes and readiness closeout notes register with the Phase 9 navigation guard. Close, project/route navigation and browser history offer Keep editing or Discard for dirty drafts, while pending mutations block navigation. Inline title/task/subtask autosave keeps its current workflow. Dialog and menu controls retain named actions, field-associated errors, polite success messages and focus restoration. Mobile header/utility wrapping and independent view/canvas scrolling keep the document within 390px; the navigation regression also covers 320px.

## Validation and rollback

See `phase10-delivery.md` and `phase10-evidence/evidence.json` for actual runs and captures. Browser checks use the real live Vite frontend with synthetic intercepted auth/REST/gateway/realtime responses. They verify UI behavior and capability presentation, not deployed JWT/RLS policies. Source and migration inspection establish that no new authority correction belongs to this slice. Native zoom and assistive-technology sessions were not measured.

Rollback the focused catalog, identity/settings adapters, guard registrations, readiness presentation snapshot and preference synchronization. Restore the previous header/view discovery without reverting existing user task mutations or earlier phase changes. Canonical project/task data, service signatures, URL IDs and local preference keys remain compatible; no data migration needs rollback.
