
## 2024-05-18 - [Add aria-labels to dynamic topbar controls]
**Learning:** For dynamic elements with visual numbers (like a notification badge count), setting an `aria-label` with the interpolated count directly on the container (e.g. `aria-label="Notifiche, <%= count %> da leggere"`) and marking all inner visual elements (like `<i>` or `<svg>` icons and `<span class="badge-count">`) with `aria-hidden="true"` prevents screen readers from redundantly announcing the count or raw icon elements while providing clear context.
**Action:** When adding labels to dynamic notification or count components, always interpolate the value in the parent's `aria-label` and mask child visualization nodes with `aria-hidden="true"`.
