## 2024-06-13 - Accessible Notification Badges
**Learning:** When displaying dynamic notification counts (e.g., badges over icons), screen readers often read the icon and the number separately, losing context or announcing redundant info.
**Action:** Added `aria-label` to the link container that dynamically interpolates the badge count (e.g., "Notifiche, 1 da leggere") and applied `aria-hidden="true"` to both the icon and the badge counter to ensure screen readers announce exactly one clear, contextual message.
