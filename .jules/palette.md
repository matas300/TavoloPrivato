## 2024-06-12 - Dynamic ARIA labels on notification badges
**Learning:** When adding `aria-label` to containers with dynamic text (like notification badges with counts), interpolate the dynamic value directly into the `aria-label` and add `aria-hidden="true"` to the inner visual elements to prevent screen readers from masking or redundantly announcing the content.
**Action:** Always check interactive elements with inner dynamic text nodes for proper `aria-label` and `aria-hidden` attributes.
