# Duplicate discovery and presentation workflows

| Related surfaces | Canonical relationship and difference | Frozen treatment / owner |
| --- | --- | --- |
| My Tasks, My Subtasks, Leading, Deadlines, History | Canonical tasks/subtasks, personal vs lead ownership; distinct deadlines/history actions | Combine discovery in My Work, retain routes and actions; 13 |
| Head Tasks vs Member My Tasks | Office-wide management vs personal delivery, overlapping widgets | Preserve scope; no rename of all Office work to My Work; 9/13 |
| Global Reviews, task drawer reviews, project Reviews | Shared task/subtask review data with different actor eligibility and context | Inbox entry plus contextual inspector; preserve underlying review handler; 12/13 |
| Notifications, alert badges, invitations, approval queue, cash review | Discovery over separate feeds and independently authorized state machines | Unified Inbox requires G4 feed/entity contract; no merged approve action; 13/16 |
| Table, Board, Gantt, Timeline, Calendar, Dashboard, Offices | Views over canonical project tasks; filters/edit capability and Office collaboration panel coexist | Project view layer, shared inspector, preserve Board return and Office View tasks; 10–12 |
| Office Team, Team Supervision, Identity & Access, Team Intelligence | Directory, management, private identity and analytics differ in scope and permission | Workspace People/insights subviews; Head and explicit system grants separate; 14 |
| Project AI import vs work-plan/proposal import | Document review and atomic commit share patterns but have distinct payloads/authority | Share progress/review UI where suitable; preserve each service and idempotency contract; 15 |
| Personal Performance/Work Report, Office Reports, project Reports | Subject/Office/project scope differ despite chart/export overlap | Scope-specific views, common export presentation only; 13/16 |
| Office budget, project budget, task cash panel, Accounting five views | Overlapping records; allocation/review/release/settlement/journal responsibilities differ | Contextual summaries and dedicated Accounting discovery; no authority merge; 16 |
| Vibe Modal, Radix FeatureDialog, feature-specific dialog bodies | Multiple shared foundations plus feature layouts; APIs are compatibility contracts | Extend adapters and converge tokens; no wholesale rewrite; 8B |
| Admin support sidebar aliases vs Administration tabs | Same platform functions; non-Admin visible links and content filtering disagree | A01 correction with allowed/denied server + deep-link parity tests; 9/16 |
| Local Office name vs canonical Office participation | Proposed identity, verified directory mapping and Head confirmation are intentionally separate | Distinct state/authority labels; not duplicate records to merge casually; Phase 6.5 / 14 |

No workflow is retired visually in this freeze. Removing an old entry requires its current caller, deep link, action, data scope and error/accessibility path to be covered by a tested replacement.
