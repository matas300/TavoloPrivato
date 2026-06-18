## 2023-10-27 - Icon-Only Buttons Accessibility
**Learning:** Many icon-only buttons in the application (such as the sidebar menu toggle, the notifications icon in the topbar, and message send buttons) lack `aria-label` attributes, making their purpose unclear to screen reader users.
**Action:** Always add descriptive `aria-label` attributes to any `<button>` or `<a>` tag that relies purely on an icon (e.g., `<i data-lucide="...">`) to convey its action, ensuring full accessibility for assistive technologies.
