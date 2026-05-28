
## 2024-05-28 - [Accessible Notification Badges]
**Learning:** When creating container links for notifications that display a dynamic count visually, adding a static `aria-label` is not enough, as screen readers may duplicate announcements or miss the dynamic count.
**Action:** Always interpolate the dynamic count directly into the parent container's `aria-label` (e.g., `aria-label="Notifiche, <%= count %> da leggere"`) and hide the internal visual elements (icons and badges) with `aria-hidden="true"`.
