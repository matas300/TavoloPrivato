## 2025-07-04 - ARIA labels for icon-only components
**Learning:** In the TavoLibero views, many critical interactive components (like menu toggles, notification bells, and chat submit buttons) rely entirely on `<i data-lucide="...">` tags without any visible text. Screen readers cannot interpret these graphic-only buttons natively.
**Action:** Always verify that interactive elements containing only icons receive descriptive `aria-label` attributes in Italian to ensure the core navigation and messaging features are fully accessible to all users.
