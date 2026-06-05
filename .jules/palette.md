## 2024-06-05 - Dynamic ARIA Labels in Notifications
**Learning:** When using ARIA labels for elements with dynamic text (like notification badges with unread counts), it is essential to interpolate the dynamic value directly into the `aria-label` (e.g., `aria-label="Notifiche, <%= count %> da leggere"`).
**Action:** Always add `aria-hidden="true"` to the inner visual elements (like icons and badge numbers) to prevent screen readers from masking or redundantly announcing the content.
