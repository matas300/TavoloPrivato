## 2026-05-22 - [Add Dynamic ARIA Labels to Notification Badges]
**Learning:** Screen readers will often redundantly read the badge content (e.g. "Notifiche 3") if the badge is visually readable but an ARIA label is also added.
**Action:** When adding `aria-label` to containers with dynamic text (like notification badges with counts), interpolate the dynamic value directly into the `aria-label` (e.g., `aria-label="Notifiche, <%= count %> da leggere"`) and add `aria-hidden="true"` to the inner visual elements to prevent screen readers from masking or redundantly announcing the content.
