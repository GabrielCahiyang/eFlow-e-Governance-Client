# All projects layout and actions

The existing Projects → All projects entry now uses content-sized Vibe table rows, explicit column proportions, readable project names/descriptions, a simpler Status label and a responsive filter layout. Existing accessible projects, filtering/sorting, creation permissions, progress calculations and project/proposal navigation are preserved.

The hand-positioned overflow menu was replaced with the shared portal-based ActionMenu. Its trigger is a native ellipsis button so pointer/keyboard handlers and focus refs reach the actual control. Open project workspace, proposal context where present, and Copy project title remain available; failed clipboard writes report an error.

Verification: 33 affected unit tests passed. The desktop browser scenario passed with long names/descriptions, real task progress, last-row menu visibility, mouse and Enter activation, Escape/focus return, search/reset, project navigation from the menu, and document overflow checks at 1920/1440/768/390 pixels. Browser data is synthetic. [Reviewed desktop screenshot](project-index-redesign-2026-10-20.png).

Final type check and production build passed. The local code graph was refreshed with the same four existing extraction warnings; the build retains its existing large-chunk warnings. No database changes were needed for this layout/menu fix.

## Recommended follow-up — proposed, not implemented

- Require an explicit project scope choice: LEDIPO only, or LEDIPO with other offices. Do not require another office for internal projects.
- Only selected, active, eligible project members should receive automatic task assignments. Use confirmed skills/experience and current workload; never add outside people or grant access implicitly. Show missing skills/team coverage instead of silently choosing unrelated people.
- After PDF import, prepare suggested leads/contributors across tasks and offer one compact review/apply action. Keep Choose people as the manual override. Preserve reviewer authority and avoid self-review conflicts.
- Extract explicitly responsible offices as proposed participants for Head review. A funding mention alone is not proof of task responsibility; generic labels such as Relevant LGU Offices require a concrete selection.
- For participating external offices require an office, a valid contact (prefill its known Head where available), and the work it will handle. Invite the contact; its Head confirms participation and chooses its own members before their work is assigned/started.
- Prefill LEDIPO's internal contact from its appointed Head. The current PDF table importer deliberately returns no offices and performs no staffing operation; these are the missing integration steps. The current staffing context also considers the lead office's wider roster, so it should be restricted to the selected project team for this proposed automation.
- Allow incomplete projects to remain drafts. Before starting affected work require a responsible office and an eligible lead; contributors remain optional. Use an inline setup checklist, not another large modal.
