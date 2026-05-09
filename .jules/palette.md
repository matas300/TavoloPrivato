## 2024-05-24 - Dynamic ARIA labels for icon badges
**Learning:** When dealing with dynamic notification badges (like an unread count) combined with an icon-only button, screen readers may read the icon name and the raw number without context, which can be confusing.
**Action:** Always wrap the entire container with a dynamically interpolated `aria-label` (e.g. `aria-label="Notifiche, <%= count %> da leggere"`) and add `aria-hidden="true"` to the internal visual elements (both the icon and the badge) so the screen reader only reads the contextual string.
