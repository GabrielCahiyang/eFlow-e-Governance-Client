# R6 project file contract

General documents live in an authorized **project library**, never a workspace-wide or public library. Office and R3 personal projects retain separate authority and identifiers. Library uploads do not satisfy submission requirements, change approved evidence, or expose raw PDS. Comments remain text-only; mentions retain the existing discussion behavior.

## Authority and storage

- Every metadata read, command and storage request checks the current authenticated, verified, active profile and current project access. Admin support does not confer library access. Personal reads/writes use R3 workspace/project membership, including Viewer denial for writes. Office reads require existing project visibility plus a joined Office and its current appointed Head, selected roster membership, or existing lead-Office assignment compatibility. Observer Offices can read with those scoped rights; writes require a joined operational Office. Proposed, pending and revoked Offices cannot access the library. Mere Office affiliation never grants library access.
- Linking/unlinking additionally checks the current task in that project and current execution authority. Archived/deleted tasks and completed/archived projects prohibit writes. Archived records retain authorized reads. No client-supplied actor, Office or role confers authority.
- A new private `project-library` bucket holds general documents only. Immutable objects use `<file-id>/document`, a reserved metadata row and the uploader's authenticated identity. INSERT/SELECT/DELETE have explicit policies plus restrictive guards; UPDATE is prohibited even if another permissive storage policy exists. Existing evidence buckets and PDS policies are unchanged.
- Maximum 10 MiB, nonempty, with an explicit MIME allowlist: PDF, plain text, PNG, JPEG, DOCX and XLSX. Names are display metadata (1–200 characters, no path separators); they never form object paths. The client records SHA-256 as upload identity, not a claim of server content scanning. Commit verifies stored size and MIME metadata. Supabase Storage enforces the bucket limits; file content scanning is outside this phase.
- Downloads create fresh signed URLs with a 60-second lifetime. Current authorization is checked on signing; already issued URLs may remain valid for those 60 seconds and downloaded bytes cannot be revoked. Protected metadata uses authorized reads, not a new realtime subscription.

## Retry, provenance and deletion

1. One upload draft retains a UUID and SHA-256 across retries. Reserve is idempotent for that exact project/name/size/type/hash and actor. A changed payload conflicts.
2. The client uploads with `upsert: false`. If the response is uncertain, retry commit first: an already stored object can be finalized without uploading another copy. Commit and task-link are one transaction, with a unique `(file_id, task_id)` relation. Successful commit is never undone because refresh fails. Deliberately uploading the same bytes again creates a separate document; filenames are not identities.
3. Insert from library records a same-project source file ID, linking actor and timestamp. It neither copies bytes nor broadens the source rights. Cross-project reuse, evidence/PDS imports and public links are excluded. Upload, link, unlink and removal events retain immutable actor/time/source provenance in `project_library_events`; retries create no duplicate events. Historical identity UUIDs and names do not block existing account deletion. Current authority still requires a live eligible profile.
4. Unlink removes only a general document's task relation. It is allowed to the current task writer. Removing the source from the library requires its uploader, the current responsible Office Head, or personal workspace owner, and zero task links. Ready sources are tombstoned with actor/time; their bytes and metadata are retained for provenance. Tombstoned sources cannot be downloaded or reused. Pending uploads may be abandoned; only the original uploader can remove their uncommitted object. Approved/submitted formal evidence has no library deletion or replacement action.
5. Failed/uncertain drafts stay visibly retryable. Dismissal is guarded while pending or dirty; discarding never deletes a possibly committed object. An abandoned reservation is private to its uploader until finalized and is harmless retained metadata. Storage cleanup of abandoned objects remains an explicit operator task, not a destructive client retry.

## Release boundary

The new public API is additive:

| Operation | Input | Receipt |
| --- | --- | --- |
| `r6_list_project_files` | `p_project`, nullable `p_task` | `{can_write, files}` with ready records, task-link provenance/count and removal eligibility; denial raises an error rather than returning an empty library. |
| `r6_project_file_command` | `p_project`, nullable `p_task`, `p_command`, `p_payload` | File record/state. `reserve` accepts stable `id`, `name`, `size`, `type`, `sha256`; `commit`, `link`, `unlink`, `remove` accept the recorded `id`. Missing bytes return the pending commit receipt for recovery; conflicting or forbidden operations fail atomically. |

The private bucket and policy design follow Supabase's [private bucket access](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [Storage RLS access control](https://supabase.com/docs/guides/storage/security/access-control) contracts. SQL rehearsal does not emulate the Storage HTTP service or verify actual object bytes.

The additive CLI-created R6 migration depends on R3 plus the installed Phase 6/6.5 contracts. It does not replace existing public operations, evidence tables, policies, Python routes or task payloads. Local verification uses disposable PostgreSQL and authenticated roles; hosted Storage byte access requires deployment acceptance. Only `ixnfphgjyelhckjwjkdv` may be deployed, using an isolated migration workspace populated from live history. This implementation request does not deploy migrations.
