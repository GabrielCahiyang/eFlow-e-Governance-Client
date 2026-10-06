# Phase 11 Main Table compatibility contract

Main Table remains the existing project view under `/projects?page=Projects&project=<id>&view=tasks`. The ProjectCommandWorkspace shared filters, existing TaskDetailDrawer and SubtaskWorkDrawer, role visibility, Office identity and workflow services retain their entry points. The restored Create project action and legacy task-board return path remain available. Inline task/subitem creation still commits on blur or Enter, continues on Shift+Enter and cancels on Escape, without an Add button.

## Layout and filters

Task identity and first-column three-dot actions remain visible during internal horizontal scrolling. Header, body and summary use the same bounded column metadata. Every optional column can be hidden and resized; Task/actions cannot be hidden. Pointer resizing, Left/Right (Shift for larger steps), Home/End and double-click reset are available. The Columns picker resets all widths without restoring hidden columns. On mobile the effective task width is capped to leave room for other work; the preference is retained for larger screens.

Existing visibility key `eflow_project_columns_<projectId>` is preserved. Widths use the new browser-local `eflow_project_table_layout_v1_<projectId>` namespace, version 1. Malformed values, unknown column IDs, nonnumeric widths and blocked storage fall back safely. Project switching cannot write one project's preferences into another. These preferences are presentation only; they create no shared layout or schema.

Shared search/status/owner/Office filters have removable chips and clear-all; removing filters preserves the selected sort. Sort has a removable indicator and relevant header announcement. Owner means appointed task lead; team participation is not an owner match. Archived tasks remain excluded from visible work. Sort ties use canonical manual order and ID; filtering, sorting and resizing do not issue reorder writes. Manual movement retains the existing unfiltered/own-Office/structural-authority conditions.

## Editors, groups and state

Focused presentation cells delegate to existing operations: phase3 task patches/create/reorder, existing assignment/status services and Responsible Office control. Owner appointment explains its impact and requires confirmation. It retains current contributors and same-Office eligibility. Estimates remain planning values, not approved accounting transactions. Timeline editing changes the calendar date without stripping an existing due-time/offset suffix. Existing amount bounds, date ordering and dependency-cycle checks remain in place.

Numeric/priority/owner/status cells report Saving, Saved or a retained failure beside the cell. Retry repeats only that failed edit; refs block concurrent writes. Explicit timeline/dependency and toolbar creation forms protect dirty close, Escape, route/project navigation and browser unload through the existing navigation guard. Pending requests block closing and navigation. Failed autosave edits are guarded; successful autosave does not prompt. Creation clears the committed draft before refreshing. A refresh retry never recreates the item. Existing service refresh behavior is unchanged: notifyTaskListeners catches some subscriber failures, so the UI can distinguish only failures exposed by the current service contract.

Groups retain title/color editing, collapse and summaries. Delete empty group explains default/nonempty/unauthorized blockers, including archived tasks. A supported empty deletion requires named impact confirmation. Server denial retains the group and a retry; a committed deletion with refresh failure offers refresh alone. Nonempty deletion and bulk lifecycle edits remain unsupported.

Task team & contributors opens the existing task drawer. For shared-project Task Leads who are not Heads, this action is disabled with an accurate responsible-Office Head limitation; Task details remains available. G2's separate authority correction is not included. Observer/other-Office/Admin inspection stays read-only. Closed projects disable table execution/planning edits. Existing team-removal unfinished-subtask guards and Lead protection remain authoritative. No second inspector is introduced; Phase 12 owns that work.

## Compatibility and deferred gates

No Phase 11 schema, RLS, Python route, API payload or public service-return changes. Source migrations were inspected for structural, Office/team and removal authority. Phase 6.5 proposed local Office responsibilities remain blocked until canonical resolution. No unapproved bulk/selection mutation was introduced: Phase 8A does not supply a safe partial-success contract for it. Existing Reports/export remains reachable.

See phase11-delivery.md and phase11-evidence/evidence.json for actual checks. Browser evidence uses the real live frontend at port 5173 with synthetic intercepted auth/REST/gateway/realtime responses; it does not establish deployed RLS behavior. Prior phase evidence remains historical and untouched.

Rollback the focused layout/filter/editor/group adapters and the new width namespace only. Keep the existing visibility key, canonical data and earlier phase changes. No data migration needs rollback.
