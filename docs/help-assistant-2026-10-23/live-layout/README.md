# Larger eFlow Live modal — 23 October 2026

Live now opens up to 1,320 pixels wide and uses the viewport height with 24-pixel desktop margins. Smaller windows use 12-pixel margins. The title, context row and microphone controls keep their space; only the main content scrolls.

Long replies no longer have a second scrollbar inside the caption. Overflow-safe centering preserves the start of the content, with a start-aligned fallback for older browsers. The orb scales with available height, and text has a wider reading area. Chat and voice behavior are unchanged.

[Screenshot gallery](GALLERY.html). Browser evidence covers 1440×1000, 1280×800, 960×540 and dark mode, with long-answer checks for modal width, scrolling and footer clearance. The first cold 1440×1000 attempt timed out while waiting for the workspace shell, before opening Help; that case passed on recheck. The original log is preserved beside the recheck.

Validation: 33 voice unit tests passed; four browser cases passed in the initial run and the remaining desktop case passed separately. TypeScript check and production build passed. Logs and exit statuses are stored alongside this report.

These are synthetic desktop UI fixtures, not physical microphone or model benchmarks. Screenshot permission errors deliberately test denial recovery.
