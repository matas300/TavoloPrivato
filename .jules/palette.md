
## 2024-05-24 - Dynamic ARIA labels for notification badges
**Learning:** When dealing with notification badges that have dynamic unread counts, applying an `aria-label` only to the container and omitting `aria-hidden` on the inner count span will cause screen readers to announce both the container's label and the inner span's text redundantly, creating a confusing experience.
**Action:** When adding `aria-label` to containers with dynamic text (like notification badges with counts), interpolate the dynamic value directly into the container's `aria-label` (e.g., `aria-label="Notifiche, <%= count %> da leggere"`) and add `aria-hidden="true"` to the inner visual elements to prevent screen readers from masking or redundantly announcing the content.
