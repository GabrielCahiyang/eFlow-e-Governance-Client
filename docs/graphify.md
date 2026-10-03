# Local Graphify repository map

Graphify is development navigation for the combined eFlow repository: frontend, Python gateway, Supabase migrations, and tests. It does not run inside eFlow or connect to the deployed database.

The official `graphifyy[sql]==0.9.74` package is installed in `.graphify-venv`, independently of the gateway environment. Python 3.12 and Node/npm are required. Commands work from this repository and do not require environment activation or a global Graphify install.

| Purpose | Command |
| --- | --- |
| Install/reinstall the pinned package | `npm run graph:setup` |
| Build the initial map | `npm run graph:build` |
| Refresh code after structural changes | `npm run graph:update` |
| Find relevant implementation locations | `npm run graph:query -- "role navigation"` |
| Find a relationship path | `npm run graph:path -- "AuthProvider" "normalizeUserRole"` |
| Inspect a node and its neighbors | `npm run graph:explain -- "AuthProvider"` |
| Open the interactive map | `npm run graph:open` |

The initial build explicitly uses `extract --code-only --no-cluster`, followed by `cluster-only --no-label`. Updates use the local AST updater with clustering disabled, followed by the same deterministic clustering step. The wrapper removes inherited model-provider configuration and disables skill auto-refresh. It never installs assistant skills, registers hooks, or enables an MCP server. No model calls or API keys are needed.

Local outputs live in `graphify-out/`: `GRAPH_REPORT.md`, `graph.json`, `graph.html`, and extraction/cache metadata. They and the isolated environment are ignored by Git. A new checkout therefore runs setup and build once; do not stage generated outputs. The report may use numeric community names because model-based community naming is intentionally disabled. Large graphs may render a community overview in HTML while retaining the complete queryable JSON map.

`.graphifyignore` admits source, gateway, migrations, scripts, tests, and selected root configuration files. It excludes dependencies, caches, generated output, database dumps, backup/snapshot exports, environment/credential files, generated schema fixtures, documents, and media. Plans and documentation remain available for direct reading.

For broad questions, read the report once or issue a focused query capped at approximately 1,500 tokens, then inspect the smallest relevant source set. For known single-file changes, go directly to the source. Queries and graph edges are navigation hints; verify direction, confidence, historical migrations, test-only references, and runtime entry points in source. Missing frontend-to-RPC or Python-to-SQL relationships are not evidence that a dependency is absent.

Repeated SQL function names across migrations are intentionally separate nodes. When `path` or `explain` reports ambiguity, select the migration explicitly using `path::symbol`, for example `supabase/migrations/20261003000004_simplified_roles_and_office_authority.sql::public.settle_accounting_liquidation()`. A migration's presence in the graph does not mean it has been deployed.

Refresh after structural changes. If Graphify warns that a smaller extraction would overwrite a larger graph, inspect its diagnostics first: intentional deletions can require `npm run graph:build -- --force`, but failed or partial extraction must be corrected instead. If the map cannot answer a question, fall back to a focused repository search.

The installed TypeScript parser reports partial extraction of five existing feature barrel files (`guided-tours`, `productivity`, `subtasks`, `team-management`, and `work-templates`). Their implementations remain indexed; inspect barrel exports directly when tracing public APIs. CSS/SCSS is not supported by this code extractor. Parser warnings are map limitations and do not establish application compile errors.

Initial setup scanned 1,163 code files and generated 6,185 nodes, 18,397 edges, and a 316-community visual overview. Brief checks confirmed TypeScript, Python, and SQL coverage, the AuthProvider-to-role-normalizer call path, relevant role/review/settlement locations, and successful AST updating. Secret files, database dumps, the deployed-schema fixture, and the gateway environment were absent from graph sources. The generated report recorded zero input/output model tokens. No application regression suite or savings benchmark was run for this tooling integration.

Removing the tooling means removing its npm commands, instruction section, requirements/wrapper, ignore entries, and local environment/output directories. Application runtime and database state require no rollback.
