## 2024-05-18 - Dynamic ARIA labels for badge notifications
**Learning:** When displaying notification badges or counters with icons, applying standard `aria-label` is not enough. Screen readers may read the icon label (e.g., "Notifiche") and then confusingly read the badge count out of context (e.g., "3").
**Action:** Always interpolate the dynamic count directly into the container's `aria-label` (e.g. `aria-label="Notifiche, <%= count %> da leggere"`) and apply `aria-hidden="true"` to both the icon and the badge inner elements to create a single, clear announcement.
