# R10 work discovery and workspace summaries

Implemented locally 8 October 2026. This phase changes presentation and read orchestration; it introduces no database migration, RPC, public payload, role or mutation authority. R3/R7/R9 remain the server contracts for placement, descendants and current access.

## Navigation and retained workflows

- My Work has four destinations: Assigned work, Leading, Subtasks and History. All my work, Today, This week and Overdue are date filters. Search, date, selected workspace scope and recent-history preference are URL state and participate in guarded Back/Forward navigation.
- Office assignment/contribution/recommended-lead discovery remains compatible with the existing personal selectors. Effective leadership still uses `isTaskLead`: an actual appointed Lead takes precedence over an old recommendation. A descendant assignment appears in Subtasks; it does not imply assignment or leadership of its root. Leading also discovers current descendant Leads.
- Work tools retain the task board/workspace, deadline calendar, reports, performance and detailed task history under their existing role/permission grants. Detailed history retains the legacy Needs changes/Reopened lenses. Office tools use the shell's context switch when opened from personal/shared workspaces. Review and invitation decisions remain in Inbox/Members.
- Office roots open the existing TaskInspector, Office descendants open SubtaskWorkDrawer, personal roots reuse PersonalTaskList in a contextual inspector, and personal descendants open the current WorkTree with the selected node highlighted and scrolled into view. Execution, evidence, staffing, progress, submission, review and dirty-draft safeguards remain with their existing owners. Closing restores the originating row or the search field if the row disappeared.
- Non-Admin `/home`, `/dashboard` and `/overview` open Workspace Overview. Admin Home retains the administrative landing. Old My Work date/recent bucket bookmarks retain their filter. Legacy task, leading, subtask, deadline, performance and task-history URLs remain valid.

## Aggregation and source coverage

My Work is explicitly independent of the shell's selected workspace. It reads only through the signed-in Supabase client and existing authenticated operations:

1. Authorized Office tasks/projects/subtasks and R7 assigned-branch roots.
2. The R3 authorized workspace list and selections, excluding display shortcuts.
3. Authorized personal-project snapshots and each root's R7 tree.

The service deduplicates projects and work by stable source identity. Context includes the containing workspace, project, applicable Office, root and depth. An optional workspace filter restricts this feed without changing the shell selection. Completed/cancelled/archived work leaves active destinations; History retains only relationships that are still returned by authorized sources. It does not reconstruct removed assignments from audit history or resurrect expired projects.

REST source reads use stable ID ordering and 500-row pages. A later-page error or the 20,000-row safety ceiling rejects that source instead of publishing a truncated total. Workspace/project/tree reads use at most four concurrent calls per batch. Independent failures preserve successful sources with an explicit coverage error. My Work counts are labelled as loaded items when coverage is incomplete; Overview withholds totals until all required sources succeed. Missing R3/R7 operations preserve supported legacy Office workflows rather than introducing client-side authority. Personal Overview cannot publish zero totals for an unavailable personal API.

Workspace Overview restricts Office work to projects returned in that workspace plus its legacy standalone Office tasks. Personal Overview reads only projects actually placed in that personal workspace, excluding Office shortcuts, and makes no Office table/root-discovery requests. Active projects, due/overdue work, missing appointments and awaiting-review notices come from those sources. Project Overview remains inside its project. Own-Office Heads can expand the existing Office insights/dashboard; no Getting Started card is introduced.

These are current authorized summaries assembled from several reads, not transactionally consistent database counts. Large-dataset latency, transport and performance acceptance remain with R13/Phase 18; R11 owns complete paginated Activity and printing.

## Dates, freshness and authority

- Date-only deadlines retain their calendar date. Timestamp deadlines use the containing workspace timezone; legacy Office sources fall back to Asia/Singapore. Today and Monday–Sunday week boundaries use that same timezone, including DST. Invalid/undated values stay out of due filters.
- Recently completed is explicitly the existing **last update within seven calendar days** proxy, not a fabricated completion timestamp. Personal completion timestamps are unavailable; personal closed work is discoverable in History but is excluded from that proxy. Missing Office-descendant timestamps are also excluded.
- Feeds refresh on mount, focus, explicit retry/refresh, R9 access-change events and a fifteen-second polling interval. Polling does not overlap a still-running load; normal freshness depends on source completion. Actor/workspace/project-scope changes clear previous data immediately, and generation checks reject late old responses. An empty selected project scope is distinct from an unrestricted legacy fallback.
- R7's current eligible-person facts gate active assigned rows and leadership. Unexpected tree/access denial removes the affected work and reports the failure. R9-cleared assignments disappear after a fresh read. Closed history remains only when the server still permits it. Open inspectors become read-only when their feed item disappears; their existing source hooks and mutation operations independently recheck access.
- No persistent protected task subscription or new cached grant is added. Browsers and this aggregation layer cannot confer eligibility, renew access, approve invitations or bypass server review rules.

## Acceptance boundary

Synthetic browser tests prove navigation and interaction; disposable authenticated PostgreSQL tests prove the existing R3/R7/R9 allow/deny predicates. Genuine multi-session hosted expiry/removal, Storage and transport acceptance remains open. Sole future hosted target is `ixnfphgjyelhckjwjkdv`, using the dated Phase 6.5 live addendum and preserved live migration history. No hosted changes were made for R10.
