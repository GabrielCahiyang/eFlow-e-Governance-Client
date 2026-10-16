# Final manual browser verification

14 October 2026. Direct CUA inspection of the final built app, using synthetic authorized Head, Member, Accounting Staff and Admin contracts. The local adapter has no external API fallback. No real account, permission, financial, migration or hosted operation was performed.

| Observation | Evidence |
| --- | --- |
| All four roles in both light/dark themes retain one page heading, Figtree and their existing context. Desktop and mobile have no whole-page horizontal overflow. | Sixteen role/theme/viewport records in `manual-measurements.json`; corresponding desktop and 320/390 captures. |
| The existing wordmark uses its existing white variant in dark mode: 14.44:1 against the header. The default light variant remains 17.30:1. | `manual-measurements.json`, all sixteen representative captures. P6's earlier dark captures preserve the original defect for comparison. |
| At 320/390, Open navigation, Help, notifications, messages and Account remain reachable at 44×44px and within the viewport. | Eight mobile measurement records and corresponding captures. Existing compact desktop communications controls remain; this is not a claim that every desktop icon has a 44px target. |
| Collapsing My Work removes its rail selector and presents the existing compact destination fallback in the content. The search/filter row and distinct tools remain clear. | `member-light-collapsed.jpg`. |
| An empty work search explains the result and offers Clear search and filters. It retains the selected workflow and navigation context. | `member-dark-320-filtered-empty.jpg`. |
| Head Budget retains one local view picker, FY/status, operational stage summaries and Office scope in both themes. No Accounting-only redirect or operation was invoked. | Four `head-*-budget-*` captures. |
| The preserved workspace switcher opens with search focused; Escape returns to the same Planning Office Workspace trigger. Its existing spacing and grouping remain. | `head-light-workspace-switcher.jpg`; browser switcher suite additionally checks long names, internal scrolling and footer reachability. |
| Admin has one grouped rail/drawer with all eleven eligible destinations. The mobile drawer scrolls internally, its Close target is 44×44 and selecting Account Audit returns focus to Open navigation. | `admin-light-320-drawer.jpg`; manual AX readings. |
| Long account names wrap. The table contains horizontal scrolling, with a focusable region supporting ArrowRight to expose Workload/Unavailable; this does not scroll the whole page. | `admin-dark-desktop.jpg`, `admin-dark-table-keyboard-scroll.jpg` (observed scroll≈59px, client width=1,041, content=1,100). |
| The eligible Delete label now uses the existing negative-text token (`rgb(255,194,184)` in dark mode), preserving its original handler, protected-account disablement and confirmation. | Final dark directory captures; final Chromium/WebKit Axe audit has no serious/critical findings. Earlier 4.41:1 failure remains recorded separately. |
| Empty Account Audit retains the bounded permitted-record explanation (0 loaded of 0), filters and separate immutable history. Its AX tree includes Nothing to show / No permitted administrative events. | `admin-light-320-empty-audit.jpg` shows the top-level bounded feedback; the empty table is below the initial fold. |
| Accounting Journal has one general destination rail on desktop and one compact destination picker on mobile, alongside the necessary FY. Its empty state explains automatic posting and preserves authorized Post adjustment. | Four `accounting-*-journal-*` captures. No financial action was invoked manually. |

Automated final acceptance also covers 768px, 640×450 CSS-pixel reflow, keyboard focus/return, forced colors, dirty discussion rotation and reduced motion. The 640px check is a 200%-zoom reflow surrogate for a 1280px window; native browser-menu zoom and a native screen reader were not exercised. Chromium and WebKit results are local browser evidence. Genuine hosted JWT/RLS/Storage/provider behavior, physical phone acceptance and Firefox remain unverified.

All 22 JPEGs are unedited direct browser captures. Earlier transient frames were not accepted as final screenshots. The screenshot manifest records actual dimensions and SHA-256 values.
