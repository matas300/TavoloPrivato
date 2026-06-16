## 2025-02-12 - Dynamic ARIA labels for notification badges
**Learning:** When a container like a notification bell has dynamic text (e.g., a badge count), screen readers will announce it poorly if unlabelled.
**Action:** Interpolate the dynamic value directly into the container's `aria-label` (e.g., `aria-label="Notifiche, <%= count %> da leggere"`) and add `aria-hidden="true"` to inner visual elements to prevent redundant announcements.
