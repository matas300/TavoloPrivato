## 2024-05-08 - Dynamic ARIA Labels for Notifications
**Learning:** Adding an `aria-label` to a container with dynamic text (like a notification badge with a count) completely masks the child text from screen readers. If the count is important, it must be interpolated directly into the `aria-label` attribute value.
**Action:** Always interpolate dynamic textual information into `aria-label` attributes if it exists within the container, and use `aria-hidden="true"` on the visual elements to prevent redundant announcements.
