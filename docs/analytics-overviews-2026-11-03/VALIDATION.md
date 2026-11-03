# Validation — Analytics implementation

## Passing checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run check` | Passed after final source edits | logs/typecheck.log |
| `npm run build` | Passed after final source edits | logs/build.log |
| Affected navigation, startup, feature-boundary, charts, selectors, employee workspace and role routes | 47 tests passed across 11 files | logs/targeted-regressions.log |
| Financial accounting summaries and navigation/employee interactions | 23 tests passed across 4 files | logs/financial-navigation-tests.log |
| Final chart/employee interactions, including unfinished-work drilldown | 8 tests passed across 2 files | logs/final-interactions.log |
| Updated expectations for approved navigation, seven project views and Employee terminology | 40 tests passed across 4 files | logs/approved-contract-retests.log |
| Head, Member and Accounting desktop browser walkthrough | 3 passed at 1440 × 1000; project Analytics also checked at 1100 px | logs/three-role-desktop.log |
| Head dark-mode desktop overview | Passed at 1100 × 950, no document horizontal overflow | logs/dark-desktop.log |
| Final Employee 360 responsive-panel adjustment | Head desktop walkthrough passed again | logs/employee-layout-desktop.log |
| Hosted authenticated-role reads | Three existing identities could read their authorized task/history sources; transactions rolled back | READ_ONLY_LIVE.json |
| `npm run graph:update` | Completed; four existing parser warnings remain | logs/graph-update.log |

These groups overlap; their counts must not be added into a single unique-test total. Browser tests intercept backend responses and do not mutate the hosted database. Hosted checks were read-only role-scoped SQL, not browser acceptance of a financial transaction.

## Full suite: not completely green

The full run, started before the final test updates, completed with **2,270 passed / 17 failed tests**, and **375 passed / 13 failed files**. It also reported a pre-existing empty suite in `subitemReviewDetail.test.tsx`. See logs/full-suite.log.

Four failures were stale assertions directly affected by the approved design and have since been updated and re-run successfully:

- Member now lands on its work overview instead of immediately opening Assigned work.
- The duplicate Intelligence sidebar entrance is consolidated into Analytics, with legacy routes retained.
- Projects retain their six existing core views and add a seventh Analytics view.
- The requested Employee Analytics / Employee 360 wording is explicitly allowed in the two analytics/coaching modules; retired role and department terms remain checked elsewhere.

The 40-test re-run covering these files is green. The entire twenty-minute suite was not repeated after those assertion updates.

Remaining failed tests from that full run are outside the new analytics feature:

| File | Failure observed |
| --- | --- |
| subitemReviewDetail.test.tsx | Empty describe suite |
| budgetDesignSystemPresentation.test.ts | Static source expectation for the previous Dialog markup |
| nestedWorkCollapsedReadiness.test.tsx | Five-second timeout during the full parallel run |
| nestedWorkCommandForms.test.tsx | Old subtree-deletion wording/command expectations |
| nestedWorkHierarchy.test.tsx | Previous action-column position and reordering controls |
| reviewEvidenceDetails.test.ts | Still expects the retired `75%` progress display |
| subitemInspector.test.tsx | Previous child-editor/reorder interaction expectation |
| workBudgetCallerGates.test.tsx | Previous cash form/funding-source interaction expectations |
| workspaceRefinementHierarchy.test.tsx | Owner-refresh/reorder interaction expectation |

They are recorded as unresolved tests, not a claim that the whole application is verified or that every failure is harmless. No unrelated task, funding, hierarchy or review behavior was changed to make these old expectations pass.

## Data limitations

The live check found two visible tasks, four status-history rows and no submissions/updates for each of the three existing account identities. Timing and on-time submission metrics therefore have insufficient live samples today. The UI says so and does not invent performance rankings.

No schema migration, deployment, invitation email, credential change or workflow-data mutation was required or performed for this task.

## Existing build and indexing warnings

The production build still warns about some chunks above 500 KB and pre-existing mixed dynamic/static imports. Graphify still flags the existing guided-tours, productivity, ProjectTaskRow and work-templates parsers. Its refresh completed without forcing a smaller graph. These are not hidden as passing clean-up work in this report.
