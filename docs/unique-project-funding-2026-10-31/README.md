# No repeated funding sources — October 31, 2026

A selected Office Budget source is disabled in all other draft rows. The add-row button stops when the number of rows reaches the number of available sources. Removing a row makes its source available again. Validation rejects duplicate sources with **Use each budget source only once.** The rule is per submission; intentional later top-ups remain possible.

Installed migration `20261031125302_prevent_duplicate_project_funding_sources.sql` adds private-schema triggers to enforce the rule for both funding commands and pending funding requests. Duplicate authorization is rolled back atomically, including its budget reservation and audit inserts. Existing command receipts are untouched, so retries of earlier saved requests remain compatible. Existing pending duplicate requests can be declined and resubmitted using one amount per source. No funding amounts or historical rows were rewritten.

Deployment selected only this migration in a workspace populated with exact live migration history. The verified 12:45 UTC database/roles backup was reused within its one-hour validity window; an additional 12:53 backup attempt timed out and was not used. Existing 115 public-table fingerprints were unchanged. See `DEPLOYMENT_RECEIPT.json`.

Verification covers duplicate source denial, distinct source funding, safe retries, source limits, date guards, historical funding compatibility and unchanged task/Office Budget charging. UI checks cover disabled options, source availability after removing a row, maximum row count and the existing setup flow. Test writes are rolled back. Actual browser testing remains with the user.
