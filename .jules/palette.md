
## 2024-05-24 - Dynamic ARIA Labels on Notification Badges
**Learning:** When using notification badges with unread counts, applying the ARIA label directly to the icon or using multiple ARIA labels causes confusing screen reader output.
**Action:** The `aria-label` must be applied to the outer `<a href...>` link tag (interpolating the dynamic unread count directly, e.g., `aria-label="<%= unreadCount > 0 ? 'Notifiche, ' + unreadCount + ' da leggere' : 'Notifiche, 0 da leggere' %>"`), and all internal visual elements (`<i data-lucide="bell">` and the unread count `<span class="badge-count">`) must have `aria-hidden="true"`.
