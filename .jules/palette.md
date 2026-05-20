
## 2026-05-20 - Enhance Topbar Accessibility
**Learning:** When adding ARIA labels to containers with dynamic text (like notification badges with counts), it is best to interpolate the dynamic value directly into the `aria-label` (e.g., `aria-label="Notifiche, <%= count %> da leggere"`) and add `aria-hidden="true"` to the inner visual elements to prevent screen readers from masking or redundantly announcing the content.
**Action:** Apply dynamic ARIA labels with interpolated values on parent elements and hide internal decorative or textual elements with `aria-hidden="true"` in all similar notification/badge UI components.
