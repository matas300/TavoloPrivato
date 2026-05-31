
## 2024-05-30 - Topbar ARIA labels and dynamic interpolation
**Learning:** When adding `aria-label` to interactive elements containing dynamic text like notification badges (`<%= unreadCount %>`), the label itself should contain the fully interpolated string. Inner elements such as icons and badges should then be marked with `aria-hidden="true"` so that screen readers announce the container's label correctly instead of repeating the individual parts.
**Action:** Add `aria-label` to the container and `aria-hidden="true"` to inner components to provide a clear and succinct announcement for screen reader users.
