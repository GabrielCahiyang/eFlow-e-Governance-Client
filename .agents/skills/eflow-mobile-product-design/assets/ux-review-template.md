# eFlow Mobile — UX design review / implementation handoff

**Reviewed:** [date, timezone]
**Mode:** Design-only / Implementation explicitly authorized / Acceptance audit
**Mobile `main`:** [SHA]
**Web `main`:** [SHA]
**Existing product sources:** [paths]

## Decision memo

**Product outcome:** [What gets easier and what integrity must remain intact]
**Recommendation:** Keep [x] / Refine [y] / Defer [z] / Shared-contract blocker [w]

## Current-state delta ledger

| Requirement | Latest state | Source evidence | Proposed change | Approval needed |
| --- | --- | --- | --- | --- |
| [Feature] | DONE / POLISH / BLOCKED / NEW | [path/function/test] | [specific user behavior] | [yes/no] |

## Screen specification: [name]

**Actor + workspace:** [Head/Member/Accounting / Task Lead/Subtask Lead/contributor]
**Job statement:** As ..., I need ..., so that ..., subject to ...
**Entry/exit:** [exact route, Back behavior]
**Information hierarchy:** [context → status + metric → main action → details → history]
**Phone layout:** [360/390/430dp, scrolling, pinned columns, safe area]
**One primary CTA:** [visible label, actual transition]
**Secondary actions:** [menu/link or none]
**Exact copy:** [title, field labels, helpful/error/pending/success text]
**Permission/source:** [server/RPC/field, RLS/Office/actor/revision]
**State matrix:** [loading, empty, ready, pending, blocked, conflict, offline, confirmed]
**Accessibility:** [screen-reader order, hit targets, 200% text, contrast]

## Cross-app and workflow impact

[actor A submits → pending state → actor B decides → verified server receipt → Mobile/Web/Activity/Inbox refresh]

## Open product decisions

| Question | Recommended answer | Must approve before implementation? |
| --- | --- | --- |
| [e.g. Which contributor actions need validation?] | [proposal] | Yes |

## Verification & release

| Scenario | Automated | Android signed-in | iOS native | Result / blocker |
| --- | --- | --- | --- | --- |
| [exact user action] | PASS/FAIL/NOT TESTED | ... | ... | ... |

**No unapproved writes:** [yes/no and explanation]
**Risks:** [safety, privacy, finance, usability, performance]
**Explicit next authorization needed:** [one narrow request; no implied consent]
