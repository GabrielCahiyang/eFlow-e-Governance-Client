# Task budget controls — October 31, 2026

The task budget modal now offers **Cancel allocation** when the whole line is unused, or **Return unused funding** when only part can be returned. The user enters a reason and confirms the amount being returned. **Keep allocation** backs out without a write; **Close** closes the budget modal. Writes/uncertain retries temporarily lock closing and other cancellation controls.

Cancellation uses the installed `release_project_task_funding` RPC. It returns unused funds to the project, without charging or releasing Office Budget a second time. Spent money, live cash obligations and protected subtask allocations cannot be removed. A fully returned allocation is cancelled by the existing server command. Uncertain retries retain the original command key, amount and reason.

Both project and task funding pickers exclude sources with zero available money. A source selected in one row is disabled in other rows. Add-row controls stop at the count of available sources; removing a row makes its source available again. Task allocation now performs the same source-specific balance/duplicate validation as project funding, before sending a request. Existing backend duplicate and available-balance checks remain authoritative.

Verification: 16 focused UI/validation tests passed, including cancellation retry identity, backing out, zero-balance filtering, row limits and overbudget messages. The 16 rollback-only installed-database assertions include protected subtask funding, cancellation returning funds exactly once, and a fully returned allocation no longer being active. Existing project/date/authority guards remain covered. No test data was retained. No schema migration was needed.

Actual browser layout checks remain with the user.
