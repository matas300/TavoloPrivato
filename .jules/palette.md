
## 2024-05-24 - Accessible Notification Badges
**Learning:** Screen readers can disjointedly read dynamic text in notification badges or icons without labels, especially when combining visual icons with text counts.
**Action:** Always add an interpolated `aria-label` to the outer container (e.g., `aria-label="Notifiche, <%= count %> da leggere"`) and hide the inner visual icon/badge using `aria-hidden="true"`.
