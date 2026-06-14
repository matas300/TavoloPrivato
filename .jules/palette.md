## 2024-05-24 - Dynamic ARIA labels for notification badges
**Learning:** When using notification badges with unread counts inside icon links, screen readers may announce confusing raw numbers or hide the context.
**Action:** Always interpolate the dynamic unread count directly into the parent link's `aria-label` (e.g., `Notifiche, X da leggere`) and apply `aria-hidden="true"` to the internal icon and badge elements to prevent redundant or out-of-context announcements.
