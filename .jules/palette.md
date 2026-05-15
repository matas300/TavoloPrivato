## 2024-05-15 - ARIA Labels on Notification Bells with Dynamic Counts
**Learning:** When adding `aria-label` to elements that contain dynamic notification badges (e.g. "unreadCount"), the dynamic variable should be interpolated directly into the parent's `aria-label` attribute (e.g. `aria-label="Notifiche, <%= unreadCount %> da leggere"`).
**Action:** Always add `aria-hidden="true"` to the internal `<i data-lucide="bell">` and the `.badge-count` span to prevent screen readers from redundantly announcing the icons or the raw number after reading the parent's label.
