## 2024-06-08 - Dynamic ARIA labels for Notification Badges
**Learning:** When adding `aria-label` to containers with dynamic text (like notification badges with counts), the screen reader will announce both the aria-label on the container AND the visual text of the children if not explicitly hidden.
**Action:** Always interpolate the dynamic value directly into the container's `aria-label` (e.g., `aria-label="Notifiche, <%= count %> da leggere"`) and add `aria-hidden="true"` to the inner visual elements to prevent redundant announcements.
