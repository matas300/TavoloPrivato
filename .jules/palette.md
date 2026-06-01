## 2024-06-01 - Dynamic ARIA labels for badge counters
**Learning:** Screen readers announce notification badges poorly when structural markup (bell icon + badge span) is read sequentially, sometimes missing the dynamic count context.
**Action:** When adding `aria-label` to containers with dynamic text (like notification badges with counts), interpolate the dynamic value directly into the `aria-label` (e.g., `aria-label="Notifiche, <%= count %> da leggere"`) and add `aria-hidden="true"` to the inner visual elements to prevent redundant announcements.
