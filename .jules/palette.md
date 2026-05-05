## 2024-05-15 - ARIA Labels for Icon-Only Interactive Elements
**Learning:** Lucide icons used inside icon-only interactive elements (like buttons or links) can be read redundantly or poorly by screen readers. A pattern of adding localized `aria-label` to the parent and `aria-hidden="true"` to the internal `<i data-lucide="...">` element greatly improves accessibility.
**Action:** When implementing icon-only buttons or links, always include an `aria-label` attribute translated into Italian on the interactive element and add `aria-hidden="true"` to the internal `<i data-lucide="...">` icon.
