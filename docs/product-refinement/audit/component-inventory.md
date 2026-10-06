# Component inventory for Phase 8B

[The full consumer register](component-register.md) and [components.json](inventory/components.json) identify every statically indexed dialog/modal/popover/drawer/inspector/panel/form/table/list/card/menu/alert/loading consumer, source owner, lines, candidate state evidence and coverage gap. Conditional child states are not automatically covered by a parent screenshot. Keep their existing props and callers until an independently tested slice migrates them.

| Existing foundation / public API | Consumers and behavior contract | 8B decision and validation |
| --- | --- | --- |
| `components/ui/Modal.tsx`: isOpen, onClose, preventClose, title/ariaLabel, footer, width and compatibility class props | Vibe adapter; widths map to size; locked operation prevents dismissal; focus escape allowlist for alert-dialog | Extend existing adapter; test naming, nested confirmation, Escape/backdrop, focus return and mobile bounds |
| `components/ui/FeatureDialog.tsx`: open, onClose, title, description, content/overlay class, showCloseButton | Radix dialog wrapper; hidden title/description; flexible feature-owned body | Retain feature layout API; align padding/header/footer and busy/dirty dismissal incrementally |
| `components/ui/dialog.tsx`, alert-dialog/popover/dropdown primitives | Existing portal, positioning, focus and dismissal contracts | One documented layer scale; do not replace portal controls with custom overlays |
| `components/ui/DataTable.tsx` and `ui/workspace/` shell/header/tabs/skeleton/empty/error/status/action/text controls | Cross-role shared workspaces; dense tables and contextual tabs | Tokenize spacing and consistent states first, then migrate by feature; preserve semantic headers/status text |
| `shared/vibe/` adapters and `components/workflow/primitives` | Current feature/legacy screens; Vibe button/select/class compatibility | Inventory actual consumer rows before changing wrappers; avoid a third competing component family |
| `project-table/InlineCreateRow` | Task/group/subitem parents pass onCreate/onCreated/busy callbacks; blur/Enter/Shift+Enter/failure draft contract | Feature-owned control retained; shared tokens only, no Add button reinstatement |
| TaskDetailDrawer and project/task tool inspectors | Multiple view, personal-work and review callers; capability sections vary | Phase 12 unifies inspector navigation after action/authority parity; do not discard evidence/team/finance sections |
| ProjectViewTabBar/menus/filter controls | Optional view persistence, portal menu and Board → Main table | Phase 10–12 retain filter/query/history and conditional proposal/budget options |
| LocalOfficeDialog/LinkOfficeDialog/TaskOfficeControl | Phase 6.5 local identities, explicit discard, saved/delivery/refresh distinctions | Preserve new compatibility contract; missing-schema state before deployment; authority is not a style variant |
| NotificationBell / chat panel / incoming call | Separate utility surfaces, drag/resize, unread state, navigation intent, media controls | Layer/focus and mobile containment baseline; merged Inbox discovery must not replace handlers |
| Guided-tour welcome/overlay and onboarding | Startup and Help; own progress, voice/reduced-motion/device support | Do not count a blocking welcome overlay as mobile navigation failure; capture both fresh-user and dismissed-tour states |

Priorities: semantic control padding/height and typography; named modal/menu focus and portal layers; dense table scrolling and mobile containment; shared loading/error/empty/denied/pending/saved-but-refresh-failed states. Keyboard focus remains visibly styled. Existing component families are migration targets, not deletion authorization.

No exported component API changed in Phase 8A. Static state text is a discovery aid; Phase 18 must capture each important conditional state and test containment, contrast and assistive technology semantics. File/line references are pinned by the source hash manifest, not promised stable after a refactor.
