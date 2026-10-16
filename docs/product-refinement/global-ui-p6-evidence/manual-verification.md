# P6 manual browser observations

14 October 2026, synthetic localhost-only role contracts in the in-app browser. Direct JPEG captures; no image editing. Original user tab/dev server preserved.

| Observation | Evidence |
| --- | --- |
| Head, Member and Accounting each have Getting started, Guide for this page and Tour of eFlow; Admin has the two tours only. | Eight role/theme entries in `help-menu-targets.json` and corresponding `help-*.jpg`. |
| The same menu opens from the top bar, collapsed global Help and mobile drawer Help. Drawer closes first; Escape returns to Open navigation. Collapsed Help returns to its actual global Help opener. | `help-head-light-collapsed.jpg`, `help-member-light-320-from-drawer.jpg`; manual focus reads and Chromium/WebKit regression cases. |
| Mobile menu actions measure 44px; desktop actions measure 40px. Three `before-help-*` captures retain the earlier 28px target defect for comparison. | `help-menu-targets.json`; before/after images with matching final filenames. |
| At 320px, navigation, Help, notifications, messages and Account all measure 44×44px; utilities end at x=312 within the viewport. The existing wordmark scales within the same header. | `mobile-utility-layout.json`, `help-member-light-320-from-drawer.jpg`. |
| The existing walkthrough keeps keyboard focus within its controls and returns to its opener after Escape. Other dialogs retain their own focus priority. | `guide-member-dark-320-short.jpg`; unit keyboard/urgent-dialog test and browser focus checks. |
| A 320×568 guide uses measured card height: observed top=143, bottom=492.65, height≈350. Figtree is the computed font; final capture opacity is 1. | `guide-member-dark-320-short.jpg`. |
| The retained checklist scrolls internally at 320×568 (client height≈566, content height=695). Keyboard Tab reaches Review your professional profile; the action is readable in dark mode and 44px high. | `getting-started-member-dark-320-short.jpg`, `getting-started-member-dark-320-footer.jpg`, `getting-started-member-dark-desktop.jpg`. |
| Page guidance and the complete system tour remain distinct. The system tour starts with Welcome to eFlow and role-visible steps; narration controls remain present. No record operation was performed manually. | `system-tour-member-light-320.jpg`, `guide-admin-light-desktop.jpg`. |
| Dark first run retains Skip, Continue and Close, with readable paired semantic tokens in the decorative illustration. The settled 320×568 footer fits inside the dialog and the title wraps; content scrolls internally. | `first-run-member-dark-desktop.jpg`, `first-run-member-dark-320-short.jpg`; final Chromium/WebKit Axe and original dismissal-receipt checks. |

The browser suite additionally verifies reduced motion, four viewport widths, short-screen layout, all four roles/themes, the original first-run skipped-status flow, professional-profile failed-save/confirmation protection, and dirty financial reasons before system-tour navigation. Synthetic progress/profile/financial operations are intercepted test fixtures, not hosted acceptance.

Native screen-reader, native phone, genuine account/JWT/RLS/Storage/provider acceptance and Firefox remain outside this manual proof. The protected dark wordmark contrast issue is carried to P7; these historical captures are not altered by later phases.
