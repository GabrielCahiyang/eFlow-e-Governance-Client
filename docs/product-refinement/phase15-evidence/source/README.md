# eFlow Web

eFlow is an enterprise-grade, role-based work management and local governance application designed for Local Government Units (LGUs). The platform combines governed task and project lifecycles, inter-departmental proposal collaboration, statutory municipal fiscal control, and an integrated System-1/System-2 artificial intelligence architecture powered by a dedicated local DeepSeek reasoning engine and the Laya decision layer.

The system is built on React 18, TypeScript, Vite, the Vibe Design System, Supabase (PostgreSQL with Row-Level Security and Realtime events), and a local JWT-protected Python FastAPI control gateway.

---

## Architecture Overview

eFlow utilizes a distributed, multi-tiered architecture that separates browser execution, relational data governance, administrative control gateways, and local hardware-accelerated AI inference.

```mermaid
flowchart TD
    subgraph Client ["Client Presentation Tier (Browser)"]
        UI["React 18 / Vite Client\n(Port 5173)\nVibe Design System & Figtree Typography"]
        State["Feature Controllers & Zustand Stores"]
        Inspector["Shared InspectorPanel Surface"]
        Session["Cross-Tab Inactivity Monitor (55m/60m)"]
    end

    subgraph Ingress ["Ingress & Authentication Tier"]
        JWT["Supabase User JWT Authentication"]
        CF["Cloudflare Quick Tunnel (Dynamic Ingress)"]
        Config["Supabase system_config (Endpoint Discovery)"]
    end

    subgraph Data ["Data & Governance Tier (Supabase)"]
        Postgres["PostgreSQL Database (60+ Atomic Migrations)"]
        RLS["Row-Level Security (RLS) Policies"]
        Realtime["Supabase Realtime Channels"]
        Storage["Encrypted Object Storage (Proposals, Evidence, Minutes)"]
    end

    subgraph Gateway ["Administrative Control Tier"]
        FastAPIGateway["eFlow Control Gateway (127.0.0.1:8322)\n- Supabase JWT Session Validation\n- Privileged Identity Management\n- Server-Side pg_dump Backup Engine\n- Notification Dispatch\n- AI Proxy & Job Scoping"]
    end

    subgraph AI_Node ["Private AI & Optimization Node"]
        Loopback["Loopback Ingress (127.0.0.1:8321)\nllm_auth_key Authentication"]
        Queue["FIFO Job Queue (Serialized DeepSeek Worker)"]
        DeepSeek["DeepSeek R1 8B (CUDA llama-cpp-python)\nWork Breakdown Structure (WBS) Extraction"]
        Laya["Laya Decision Layer (System-1)\nMunicipal Routing & Statutory Clearance"]
        PyGAD["PyGAD Genetic Algorithm Optimizer\nRCPSP Workload & Schedule Balancing"]
        Polygon["Polygon Blockchain Governance Ledger\nAmoy Testnet 0-MATIC Calldata Anchoring"]
    end

    UI --> State
    State --> Inspector
    State --> Session
    State -->|"Authenticated PostgREST & Realtime"| Postgres
    State -->|"Reads ai_endpoint"| Config
    State -->|"Dispatches AI Jobs (User JWT)"| CF
    CF --> FastAPIGateway
    FastAPIGateway -->|"Validates JWT & Applies Internal Key"| Loopback
    Loopback --> Queue
    Queue --> DeepSeek
    DeepSeek --> Laya
    FastAPIGateway --> PyGAD
    FastAPIGateway --> Polygon
    Postgres --> RLS
    Postgres --> Realtime
    Postgres --> Storage
```

### Architectural Boundaries and Ingress Guarantees

1. **Private AI Loopback Boundary**: The model inference server runs strictly on private loopback address `127.0.0.1:8321`. Direct external access to port `8321` is prohibited. All client AI requests must pass through the authenticated control gateway on port `8322`.
2. **Zero-Trust Client Ingress**: Remote clients never receive the internal model authorization key (`llm_auth_key`) or Supabase service-role keys. Clients authenticate using their active Supabase session JWT. The control gateway validates the JWT, enforces active-profile checks, and proxies the request to the loopback AI server.
3. **Dynamic Cloudflare Tunnel Discovery**: The AI supervisor manages a Cloudflare Quick Tunnel targeting gateway port `8322`. The active tunnel hostname, heartbeat timestamp, and health status are automatically published to Supabase table `system_config`. Client browsers subscribe to `system_config` via Supabase Realtime, enabling automatic endpoint rotation without frontend rebuilds or manual URL entry.
4. **FIFO Hardware Protection**: The local node processes one DeepSeek reasoning job at a time in GPU VRAM. Additional requests receive assigned queue positions and poll until completion, eliminating GPU memory exhaustion and concurrency collisions.
5. **Decoupled System Availability**: The gateway and tunnel remain available for administrative, task, and project workflows while the AI process restarts. If the local model node is offline or restarting, normal non-AI operations continue uninterrupted, while AI-dependent screens display explicit status messages.

---

## Role-Based Governance Matrix

eFlow enforces a strict Role-Based Access Control (RBAC) framework aligned with Philippine Local Government Unit structures:

| Role Identifier | Role Title | Primary Workspaces | Governance Scope |
| :--- | :--- | :--- | :--- |
| `superadmin` | Super Administrator | User Management, Organization Hierarchy, Entitlements, Backup & Export, Audit Logs, System Settings | Global configuration, identity recovery, disaster recovery, read-only oversight across operational projects and tasks. |
| `depthead` | Department Head / Assistant Head | Overview, Projects, Task Board, Team Supervision, Team Intelligence, Proposal Cockpit, Department Budgets, Reports | Office operations, annual budget appropriation locking, team workload balancing, proposal drafting, inter-departmental review. |
| `teamleader` | Team Leader | Work I'm Leading, Leader Reviews, Task Milestones, Subtask Allocation, Petty Cash Endorsements | Direct execution supervision, subtask ordering and assignment, evidence review, task budget distribution to subtasks. |
| `employee` | Department Contributor | My Tasks, My Subtasks, Deadlines, Task History, Performance Self-View, Petty Cash Requests & Liquidation | Direct delivery, checklist check-off with evidence submission, expense receipt submission, personal contribution metrics. |
| `executive` | City Mayor / Administrator | City Project Pulse, Portfolio Intelligence, Project Transformation, Financial Oversight, Immutable Audit | Executive monitoring, strategic goal tracking, municipal bottleneck detection, macro fiscal review. |
| `legislative` | Sangguniang Panlungsod | Legislative Dashboard, Session Management, Committee Affairs, Councilor Workspace | Council sessions, ordinance and resolution authoring, committee referrals, legislative audit trails. |
| `hrmo` | Human Resource Management | Workforce Intelligence, Wellness & Attendance, Burnout Prediction Radar, Performance Compliance | Staffing distribution, single-person dependency alerts, burnout monitoring, genetic algorithm workload simulation. |
| `finance` | City Finance / Accounting | Project Finance, Programmatic Buckets, Liquidation Review, Immutable Financial Ledger, Journal Posting | Appropriation enforcement, petty cash daily ceiling audits, two-stage liquidation approval, COA compliance. |

---

## Core Operational Workflows

### 1. Governed Task Lifecycle and Non-Repudiation

Task management in eFlow follows an audited lifecycle designed for local government compliance:

- **State Progression**: `Draft` -> `Open / In Progress` -> `In Review` -> `Changes Requested` -> `Approved / Completed` -> `Archived`.
- **Reviewer Designation and Authorization**: Each task defines primary and backup reviewers. Self-review is strictly prevented at both the database RLS level and gateway boundary.
- **Evidence-Based Submissions**: Submitting work for review requires verifiable evidence (documentation links, file attachments, or qualitative proof). Evidence records are immutable once submitted.
- **Audited Review Decisions**: Approvals and rejection attempts are recorded with timestamped reviewer notes. Approved submissions generate an SHA-256 cryptographic audit hash stored directly in the audit record.
- **Subtask Hierarchy and Dependency**: Subtasks support explicit parent-child sequencing, prerequisite dependencies, and dedicated assignees. Task leaders maintain drag-and-drop ordering authority through atomic reorder RPCs.

### 2. Inter-Department Proposal Collaboration & AI Decomposition

Municipal initiatives requiring cross-department coordination are managed through a persistent, versioned proposal engine:

- **PDF Ingestion & AI-Required Decomposition**: Proposal source documents are parsed client-side via PDF.js and dispatched to the local DeepSeek R1 8B node via the gateway.
  - The model performs Work Breakdown Structure (WBS) extraction, generating actionable activities, tasks, skills, and subtasks.
  - The output is immediately piped through the **Laya Decision Layer**, which applies heuristic System-1 governance logic:
    - Automatically routes tasks to responsible departments (IT, GSO/Procurement, CPDO, LEDIPO, BPLO, Budget, HRMO).
    - Detects statutory clearance requirements (Bids and Awards Committee / BAC resolutions, Petty Cash / Cash Advance, or standard execution).
    - Classifies priority and urgency (`High`, `Med`, `Low`) based on critical-path schedules.
    - Evaluates municipal staff skill vectors to recommend optimal personnel assignments.
  - Strict AI Integrity Contract: eFlow enforces an AI-required boundary. If the AI model is offline or returns invalid output, the application displays an explicit error. It never fabricates a silent fallback proposal.
- **Collaborative Draft Governance**:
  - Proposing departments draft and refine proposals in the `DraftCockpit`.
  - External entities participate under defined tiers: `Required Approver`, `Consulted`, or `Observer`.
  - Approval policies support quorum-based, all-signer, or sequential governance paths.
  - Board/Committee reviews generate formal meeting minutes and print-ready decision packets.
  - Committing an approved revision atomically materializes projects, milestones, task hierarchies, and team memberships within a single database transaction.

### 3. Department Fiscal Control and Petty Cash Operations

Fiscal management enforces strict accountability tied to actual project delivery:

- **Locked Annual Appropriations**: The Department Head locks the fiscal year budget. Proposals cannot be published without allocating funds against valid budget line items.
- **Proposal Budget Reservation**: Publication of a proposal atomically reserves the total required budget from the annual appropriation, creating immutable operational budget lines.
- **Subtask Budget Distribution**: Team Leaders allocate task funding to operational subtasks. Contributors request cash directly within their assigned subtask context.
- **Two-Stage Petty Cash Operations**:
  - Default daily release ceiling: Configurable ₱30,000 per day.
  - Default review threshold: Configurable ₱5,000 per receipt.
  - Request Chain: Contributor initiates request -> Team Leader provides first-stage review -> Department Head / Assistant Head issues final release approval.
  - Recipient Acknowledgement: Releases require formal recipient acknowledgement before funds are marked disbursed.
  - 15-Day Liquidation Window: Contributors submit receipt packages within 15 calendar days. Late packages require explicit Department Head approval.
  - Financial Settlement: Accounting staff perform journal posting, record returned unspent cash, and reconcile balanced ledger entries.

### 4. Process Optimization, Genetic Algorithms and Workforce Intelligence

- **PyGAD Genetic Algorithm Optimizer**: Integrates multi-objective heuristic optimization to solve the Resource-Constrained Project Scheduling Problem (RCPSP). Supports three profiles:
  - `balanced`: Harmonizes skill overlap (35%), workload leveling (25%), risk aversion (20%), and timeline makespan (15%).
  - `fast_track`: Minimizes makespan by parallelizing independent critical-path tasks (45% schedule weight).
  - `low_risk`: Strictly avoids employee burnout thresholds and penalizes known skill gaps (35% risk weight).
- **Burnout Prediction Radar (HRMO)**: Evaluates live active task load, review backlog, and overtime signals to prevent municipal staff overload.
- **Manila Monthly Productivity Leaderboard**: Computes objective monthly contribution scores (delivery, quality, speed, collaboration) based strictly on Manila timezone calendar periods. To prevent perverse incentives, leaderboard metrics are strictly excluded from AI proposal staffing recommendations.

### 5. Polygon Blockchain Governance Ledger

For non-repudiation and external compliance, project milestones are anchored to the Polygon Amoy Testnet (Chain ID `80002`):

- **Calldata-Only Architecture**: Computes canonical SHA-256 digests of proposal payloads and dispatches 0-MATIC transactions with the hash embedded in the transaction payload.
- **Genesis & Milestone Receipts**: Records proposal creation, BAC statutory clearances, cash advance approvals, and project completion.
- **Public Auditability**: Anyone with the transaction hash or document digest can verify the authenticity and chronological timestamp on the public blockchain explorer without centralized dependency.

---

## Technology Stack

| Domain | Technology / Library | Purpose & Implementation |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 18.3**, **TypeScript**, **Vite** | Component-driven UI, type safety, Hot Module Replacement (HMR). |
| **Design System & Styling** | **Vibe Design System (`@vibe/core`)**, **Tailwind CSS v4** | Consistent accessible governance UI primitives, theme tokens. |
| **Typography & Fonts** | **Figtree Variable (`@fontsource-variable/figtree`)** | Single official application font; tabular numbers for finance and codes. |
| **Component Primitives** | **Radix UI Primitives** | Headless accessible modals, dropdowns, accordions, tooltips, dialogs. |
| **Animation & Motion** | **Motion (`motion` 12.x)** | Accessible transitions, drawer motion, reduced-motion compliance. |
| **Workflow Graphs & Flows** | **XYFlow (`@xyflow/react`)**, **Dagre Layout** | Interactive directed node graphs for task dependencies and approval flows. |
| **Calendars & Timelines** | **FullCalendar**, **Frappe Gantt** | Operational schedules, milestone roadmaps, session calendars. |
| **Data Analytics & Charts** | **Recharts** | Executive KPIs, budget burn rate, workload distribution, burnout radar. |
| **Document Processing** | **Tiptap**, **PDF.js**, **SheetJS (`xlsx`)** | Rich text editor for minutes, client-side PDF parsing, spreadsheet exports. |
| **Primary Database & Auth** | **Supabase (PostgreSQL 15+)** | Relational schemas, Row-Level Security, JWT Auth, Realtime channels, Storage. |
| **Control Gateway** | **Python 3.10+**, **FastAPI**, **Uvicorn**, **httpx** | Port 8322 gateway, session verification, admin actions, backup engine. |
| **Local AI Inference Engine** | **llama-cpp-python (CUDA 12.4/12.6)**, **GGUF** | Port 8321 server, hardware-accelerated DeepSeek R1 8B local execution. |
| **Decision Intelligence** | **Laya Router (`convaiinnovations/laya-typed-decisions`)** | System-1 bounded governance heuristics, statutory clearance detection. |
| **Process Optimization** | **PyGAD**, **NumPy** | Multi-objective genetic algorithm for workforce allocation and RCPSP. |
| **Blockchain Audit** | **Web3.py**, **Polygon Amoy Testnet** | 0-MATIC calldata anchoring, SHA-256 verification receipts. |
| **Network & Ingress** | **Cloudflare Quick Tunnels (`cloudflared`)** | Zero-trust public gateway access with Supabase dynamic discovery. |

---

## Directory Structure and Module Boundaries

The frontend architecture strictly adheres to feature modularization under `src/app/features/`, where each feature exposes a focused public `index.ts` API:

```text
EflowWeb/
├── docs/                               # Architecture, flow specifications, and feature inventories
│   ├── ai-quick-tunnel.md              # Cloudflare tunnel and dynamic discovery architecture
│   ├── department-budget-flow.md       # Fiscal appropriation and petty cash workflows
│   ├── feature-inventory.md            # Compatibility baseline for modularization
│   ├── interdepartment-collaboration.md# Collaborative proposal draft and governance specifications
│   └── task-management-flow.md         # Governed task lifecycle and review rules
├── scripts/                            # Verification, backup, and live schema validation utilities
├── server/                             # eFlow Control Gateway (Port 8322)
│   ├── routers/                        # FastAPI sub-routers (admin, ai, backups, collaboration, notifications)
│   ├── services/                       # Gateway business logic (backup_service, collaboration_ai)
│   ├── gateway_config.py               # Environment configuration and settings
│   ├── gateway_dependencies.py         # JWT verification and user scoping dependencies
│   ├── main.py                         # Gateway entry point and CORS middleware
│   ├── requirements.txt                # Python dependencies for control gateway
│   └── start.py                        # Automated gateway launcher and process supervisor
├── src/
│   ├── app/
│   │   ├── components/                 # Shared UI components and layout shells
│   │   ├── features/                   # Domain feature modules
│   │   │   ├── administration/         # Identity, role defaults, organization management
│   │   │   ├── ai/                     # AI gateway client, tunnel discovery, and queue polling
│   │   │   ├── announcements/          # Broadcast notifications and communication feed
│   │   │   ├── app-shell/              # App providers, auth guard, layout shell
│   │   │   ├── audit/                  # Audit trail viewers and activity logs
│   │   │   ├── budget/                 # Appropriations, task budget lines, petty cash liquidations
│   │   │   ├── chat-calls/             # Direct messaging, task discussions, audio calls
│   │   │   ├── employees/              # Employee directories, skills inventory, PDS parser
│   │   │   ├── guided-tours/           # Accessible role onboarding and AI audio tours
│   │   │   ├── interdepartment-collaboration/ # Persistent proposal drafts, revisions, voting
│   │   │   ├── navigation/             # Role sidebar sections, routes, navigation dispatch
│   │   │   ├── notifications/          # Realtime alerts, review requests, escalations
│   │   │   ├── productivity/           # Monthly Manila-time contribution leaderboard
│   │   │   ├── projects/               # Project Command Center, milestones, Gantt roadmaps
│   │   │   ├── proposal-import/        # PDF extraction, DeepSeek R1 decomposition, DraftCockpit
│   │   │   ├── reports/                # Department Head report library, CSV/PDF generation
│   │   │   ├── reviews/                # Review queue, evidence inspection, decision recording
│   │   │   ├── role-accounting/        # Balanced journal entries, voucher disbursement
│   │   │   ├── role-department-head/   # Operations overview, supervision, workload radar
│   │   │   ├── role-executive/         # City Project Pulse, portfolio analytics
│   │   │   ├── role-finance/           # Programmatic budget oversight, liquidation approval
│   │   │   ├── role-hrmo/              # Burnout radar, genetic algorithm simulation
│   │   │   ├── role-legislative/       # Council sessions, measures, committee tracking
│   │   │   ├── session-security/       # Cross-tab heartbeat, 55m warning, 60m logout
│   │   │   ├── subtasks/               # Checklist execution, drag reordering, evidence
│   │   │   ├── tasks/                  # Task board, Kanban, hierarchy, timeline views
│   │   │   ├── team-management/        # Staff workload rebalancing, skill coverage
│   │   │   └── work-templates/         # Reusable task checklists, recurring templates
│   │   └── shared/                     # Reusable utilities, formatting helpers, adapters
│   └── main.tsx                        # Application mount and bootstrap
└── supabase/                           # Database architecture
    ├── migrations/                     # 60+ sequential SQL migrations
    ├── fresh_schema.sql                # Base bootstrap database schema
    └── README.md                       # Migration order and schema documentation
```

---

## Local Development Setup

### Prerequisites

- **Node.js 18+** (Node 20+ recommended)
- **Python 3.12** (required by the local Graphify setup; also supported by the gateway)
- **Git**
- **PostgreSQL / pg_dump** (Installed locally or via pgAdmin for Super Admin backup features)
- **Supabase Project** (Cloud instance or local Docker Supabase instance)

### Installation Steps

1. **Clone the repository and install frontend dependencies**:
   ```powershell
   Set-Location "C:\path\to\eflow-e-Governance-Project"
   npm ci
   ```

2. **Configure environment variables**:
   Create a `.env` file in the project root with the following configuration:
   ```env
   # Frontend Supabase Configuration (Browser visible)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # eFlow Control Gateway Configuration (Private, used by server/start.py)
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_private_service_role_key

   # Session pooler connection for Backup & Export (private, server-only)
   EFLOW_DATABASE_URL=postgresql://postgres.your-project:your-password@aws-0-region.pooler.supabase.com:5432/postgres

   # Local Gateway and AI Ingress Settings
   EFLOW_GATEWAY_ORIGIN=http://127.0.0.1:8322
   VITE_AI_CONNECTION_MODE=online
   ```
   > Note: Never place the Supabase service-role key or database URI in `VITE_` variables. All `VITE_` variables are bundled into the client build.

3. **Install the local repository map** (requires Python 3.12):
   ```powershell
   npm run graph:setup
   npm run graph:build
   npm run graph:query -- "role navigation"
   ```
   Run setup and the initial build once per checkout. Use `npm run graph:update` after structural edits. The environment and generated map stay local and are ignored by Git; see [Graphify navigation](docs/graphify.md).

4. **Start the eFlow development environment**:
   ```powershell
   npm run dev
   ```
   `npm run dev` concurrently executes:
   - **eFlow Control Gateway** on `127.0.0.1:8322` (automatically provisions `server/.venv`, installs requirements from `server/requirements.txt`, and enables auto-reload).
   - **Vite Frontend** on `http://localhost:5173`.

### Running eFlow with the Dedicated AI Server

To enable local AI proposal decomposition, Laya governance routing, and PyGAD optimization, run both repositories in separate terminals:

```powershell
# Terminal 1: eFlow Frontend & Control Gateway
Set-Location "..\eflow-e-Governance-Project" # or "C:\Users\gabri\OneDrive\Desktop\EflowWeb"
npm run dev

# Terminal 2: Private AI Inference Node & Tunnel Supervisor
Set-Location "..\Ollama reactjs LLM DeepSeek Integration"
npm run dev
```

If the AI node processes become stale or require cleanup, execute the scoped restart utility in Terminal 2:
```powershell
npm run restart
```
*(This cleans up stale llama-cpp, uvicorn, and cloudflared processes without interrupting eFlow).*

---

## Quality Assurance & Verification

Before committing code or declaring a development slice complete, execute the full verification suite:

```powershell
# 1. TypeScript static analysis
npm run check

# 2. Vitest unit and regression tests
npm test

# 3. Production Vite build validation
npm run build

# 4. Security verification (ensures no service-role secrets exist in dist/)
npm run verify:client-secrets

# 5. Live Supabase database schema contract check
npm run verify:live-schema

# 6. Python gateway unit tests
python -m unittest discover -s server/tests -p "test_*.py" -v
```

### End-to-End Smoke Testing (Playwright)

To execute authenticated browser end-to-end tests:
```powershell
$env:EFLOW_E2E = "1"
$env:EFLOW_E2E_ACCOUNTS = '[{"role":"superadmin","email":"admin@eflow.local","password":"your_test_password"}]'
npm run test:e2e
```

---

## Technical Documentation References

For in-depth operational flow specifications, consult the companion documentation:

- [Task Management Flow](docs/task-management-flow.md): Governed task lifecycle, reviewer rules, and evidence audit trails.
- [Department Budget & Petty Cash Flow](docs/department-budget-flow.md): Appropriation locking, subtask funding, and two-stage liquidation.
- [Inter-Department Collaboration](docs/interdepartment-collaboration.md): Multi-agency proposal drafts, voting policies, and commit boundaries.
- [AI Quick Tunnel & Gateway Integration](docs/ai-quick-tunnel.md): Dynamic Cloudflare tunnel discovery, JWT verification, and FIFO queuing.
- [Feature Inventory & Compatibility Baseline](docs/feature-inventory.md): Authoritative registry of all role routes and system screens.
- [Local Graphify Map](docs/graphify.md): Code-only architecture navigation, setup, and refresh commands.
- [Phase 1 Delivery](docs/phase1-delivery.md): Verified rehearsal results and remaining deployment gates.
- [Product Refinement Phase 12 Delivery](docs/product-refinement/phase12-delivery.md): Shared project context, task inspector, validation and remaining authority gates.
- [Product Refinement Phase 13 Delivery](docs/product-refinement/phase13-delivery.md): Personal work, action discovery, recent updates and source/authority contracts.
- [Product Refinement Phase 14 Delivery](docs/product-refinement/phase14-delivery.md): People and project Office tables, contextual inspectors, safe invitations and protected membership edits.
- [Product Refinement Phase 15 Delivery](docs/product-refinement/phase15-delivery.md): Human-reviewed document import, advisory staffing, private PDS review and official readiness resolution.
- [Database Schema & Migration Order](supabase/README.md): Sequential guide for applying database migrations.
