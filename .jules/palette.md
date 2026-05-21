## 2024-05-23 - Dynamic aria-label Interpolation for Badges
**Learning:** When dealing with notification badges or similar dynamic content in links/buttons, interpolating the dynamic value directly into a single `aria-label` (e.g., `aria-label="Notifiche, <%= count %> da leggere"`) provides a much cleaner experience for screen readers.
**Action:** Always interpolate dynamic values directly into the outer container's `aria-label` and apply `aria-hidden="true"` to inner icons and spans to avoid fragmented, redundant announcements.
