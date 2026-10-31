# Direct subtask completion — 30 October 2026

## Installed backend
Migration 20261030013255 installed on ixnfphgjyelhckjwjkdv through an isolated workspace populated with 61 live migration records. Only this pending migration was selected. Fresh verified full database archive: local deployment-backups/20261030T054619Z-phase7-main. All 115 public table fingerprints (excluding the endpoint heartbeat) remained unchanged during deployment. See DEPLOYMENT_RECEIPT.json.

## Behavior
Contextual task/subtask leads complete steps directly; no new review submission or independent subtask decision. Contributors may record progress but cannot complete another person's lead responsibility. Ordered steps wait for preceding completion; containers wait for all descendants. Parent-task final review is preserved in this stage. Closed/archive/access/evidence/financial guards remain.
Earlier pending evidence is retained as history; an authorized lead must complete the step. Operational review pointers clear on direct completion; no historical submission is deleted or fabricated as approved. New completed events preserve actor/time/note/files. Exact request identity prevents duplicate completion updates after a lost response. Attachment ownership and sealing remain checked. Completion fields lock after an uncertain attempt and retain the original retry.

## Bugs addressed
- Frontend called complete_subitem before deployment: installed authenticated API and requested PostgREST schema reload.
- Old progress-only evidence constraint rejected 100 percent: allow final completion events only through protected transaction/actor checks; normal direct progress cannot forge completion.
- Redundant approval Progress column and separate review menu removed; old review links open current work instead.
- Historical pending subtask review counts removed from current reviewer workload.
- Direct completed subitems earn collaboration credit only after their parent receives independent final approval; they are not fake first-pass approvals.
- Failure panels now have role=alert, red text/tint/border, error icon and explicit failed-action heading; notes/files stay intact.

## Verification
18 hosted SQL checks passed using synthetic work in rollback-only transactions. No persistent QA work or mail was created. See HOSTED_VERIFICATION.json.
TypeScript check and production build passed. 35 hierarchy/status/parent-readiness tests passed; 12 completion/credit tests passed; 3 team analytics tests passed. Desktop Chromium smoke passed: direct completion, return to parent, completed-step rollup and separate evidence-required parent submission. Three screenshots are stored in screenshots/. Architecture map refresh is tracked separately; four existing extractor warnings were reported.

## Scope boundary
Project setup redesign, dummy-data reset, project-lead review routing and project funding envelopes are not delivered by this migration. See ../project-flow-redesign-2026-10-30/IMPLEMENTATION.md for their explicit pending gates. This report is not whole-system acceptance. Mobile builds are not changed.
