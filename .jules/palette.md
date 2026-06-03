## 2025-05-24 - Dynamic ARIA Labels on Notification Badges
**Learning:** When creating accessible notification badges with dynamic counts in templates, placing `aria-label` on the container with interpolated values and hiding the inner visual badge with `aria-hidden="true"` prevents screen readers from redundantly announcing or misinterpreting the badge content.
**Action:** Always interpolate dynamic counts into a unified `aria-label` on the interactive container for icon+badge combinations and apply `aria-hidden="true"` to inner visual elements.
