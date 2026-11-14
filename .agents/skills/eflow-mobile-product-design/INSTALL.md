# Install and use the eFlow Mobile Product Design skill

This is a reusable **Codex agent skill**, delivered for review and manual installation. No GitHub repository or hosted Supabase project was modified in preparing it.

## Recommended repository installation

1. Download and extract the ZIP.
2. Copy the whole `eflow-mobile-product-design` folder (containing `SKILL.md`, `references/`, `assets/`) into your Mobile repository under `.agents/skills/`.
3. Confirm the file path is:

   `.agents/skills/eflow-mobile-product-design/SKILL.md`

4. Open Codex from the Mobile repository. Codex discovers repository skills; if it is not listed, restart Codex or inspect `/skills`.
5. Invoke it explicitly using `$eflow-mobile-product-design` in a prompt, or ask for an eFlow Mobile design/UX review.

If you prefer a personal skill, use `~/.agents/skills/eflow-mobile-product-design/` instead. See the official skills reference: https://learn.chatgpt.com/docs/build-skills

## Recommended first prompt

```text
$eflow-mobile-product-design
Review the latest Mobile and Web main branches against the 11 November adviser-meeting UX revisions. Start design-only: do not edit code, create commits, deploy, or modify Supabase. Audit what the latest Mobile push already implements; identify genuine gaps, especially Subtask start dates and nearest-lead contributor acceptance. Give a source-linked delta ledger, proposed screen-by-screen UX improvements, final UX copy, critical backend contract requirements, and an acceptance plan. Preserve existing mobile navigation, Figtree/brand tokens, and audited finance/approval boundaries.
```

## What the package contains

- `SKILL.md`: trigger, role, workflow, constraints, core design rules and deliverable format.
- `references/current-state-2026-11-11.md`: latest observed push, implementation delta and exact relevant source paths.
- `references/workflow-integrity.md`: approval state machine, percentages, dates, financial totals, server authority and unresolved decisions.
- `references/screen-patterns.md`: concrete UX specification for Home, table, Task, Subtask, activity, evidence, Reviews, Inbox and Accounting.
- `references/ux-writing.md`: eFlow microcopy rules and full state-specific strings, noting that the linked monday Vibe handbook could not be directly loaded.
- `references/acceptance-and-handoff.md`: tests, device requirements, risk gates and release criteria.
- `assets/ux-review-template.md`: repeatable senior design critique and approval handoff template.

**Default behavior:** design/review only. The skill must not treat its installation as permission to make code, Git or Supabase changes.
