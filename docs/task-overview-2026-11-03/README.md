# Leading task overview — 3 November 2026

Entry: **My Work → Leading → task → Overview**. The shared task inspector also presents this layout at its other entrances.

- A single summary card groups Status and Priority, with the Office in the heading.
- Deadline, Start date, Project, optional Estimated hours and Program use a responsive facts grid with system icons.
- Deadline uses the existing live countdown badge, including green/upcoming, amber/due soon and red/overdue treatment.
- Removed the old hard-coded 0%/100% progress bar. Status and recorded work remain the source of execution progress.
- Description has its own section. Existing dependencies, completion standards, cancellation details and funding controls remain available with their existing permissions.
- Layout uses shared theme tokens and wraps at narrower widths without truncating project names.
- Separately applied the requested receipt wording: **Line amount → Actual cost**, including validation messages. It still means the total paid for that purchased item; calculation and API fields are unchanged.

Validation: 11 focused overview/deadline/submission tests passed; 22 financial validation checks passed. Desktop Chromium passed the Leading entrance, overview contents, no obsolete progress bar, no summary overflow at 1440/1100/800 pixel viewport widths, and dark-mode rendering. These are fixture-based UI checks, not live data changes. TypeScript and production build passed; existing build chunk/import warnings remain.

Screenshots:

- [Desktop](task-overview-1440.png)
- [Narrower desktop](task-overview-1100.png)
- [Compact width](task-overview-800.png)
- [Dark mode](task-overview-dark.png)

The separate role-dashboard/employee analytics consolidation request is not part of this completed task-overview change.
