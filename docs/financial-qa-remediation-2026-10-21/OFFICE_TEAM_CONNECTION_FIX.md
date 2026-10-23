# Office Team connection fix — 22 October 2026

The Head's Office Team screen failed to load both Active Members and Invitations. Both requests returned HTTP 500, and the client displayed its generic error. Gateway traces show `httpx.RemoteProtocolError: Server disconnected` inside the shared HTTP/2 connection during `phase2_is_office_head`; this was a transport failure, not an empty office or missing Head permission.

## Fix

- Configure the server's supported Supabase HTTP client option to use HTTP/1.1, with separate pooled connections and a 10-second idle expiry. Preserve the SDK's 120-second read timeout.
- Retry either list's explicitly read-only operation once after a disconnect, connection failure, or timeout. Repeat the appointed Head check on that attempt. Persistent transport failures return a safe HTTP 503 message.
- Do not enable general HTTP write retries. Creating, resending, accepting or revoking invitations, membership changes, uploads, and financial postings are outside the retry wrapper.
- Preserve the existing office scope, uploader scope for private PDS attachments, returned fields, invitation filtering and Head-only access. No schema, grants, or hosted migrations change.

## Evidence

`tests/office-team-live-read.json` records three concurrent checks of the actual Python list handlers against the current hosted target `ixnfphgjyelhckjwjkdv`. Each returned LEDIPO's **7 active members and 0 invitations**, including repeated reads after idle connection expiry. All responses used HTTP/1.1. The six Member, Accounting Staff and Admin access attempts remained denied with 403. These checks made no data changes and sent no invitations.

This live receipt exercises the actual list handlers and database permission check with the existing active Head's profile. That script does not exercise a browser session or the HTTP authentication middleware. Separately, the restarted gateway logged successful authenticated requests for both lists from the current Head account; the response lines are preserved in `tests/office-team-gateway-success.txt`. Local browser control reports disabled in Work settings; isolated desktop browser checks are recorded separately.

Server regressions reproduce a disconnected authorization check and a disconnected invitation query, verify recovery and scope preservation, verify bounded failure, and verify that permission denials are not retried. A lost POST response is not replayed. The full server suite passes **112 tests**.

The desktop browser regression deliberately fails both lists, recovers with Retry, checks refreshed member and invitation counts and rows, exercises search/clear/Refresh, and asserts no invitation mutations. Its records are synthetic and all network requests are intercepted.

- TypeScript check: pass.
- Production build: pass (existing chunk warnings).
- Invitation/Office Team Chromium smoke suite: **5 passed**, including the new desktop recovery check. Existing smaller-screen account acceptance coverage is retained.
- Graph update: pass, 10,607 nodes / 35,231 edges; the same four previously documented parser warnings remain.
- Full frontend suite: **2,090 passed / 1 failed** across 345 files. The unrelated `workspaceRefinementNavigation` sidebar test exceeded its 5-second timeout while checks ran concurrently. Its separate recheck passed all **12 tests**, with no source or timeout changes. Both receipts are retained; this is not labeled a fully passing suite.
- Actual gateway anonymous checks: both lists return **401**. Authenticated Head requests for both lists return **200**, as recorded separately.
- [Members recovery screenshot](screenshots/isolated-browser/office-team/office-team-members-recovered.png).
- [Invitations recovery screenshot](screenshots/isolated-browser/office-team/office-team-invitations-recovered.png).
