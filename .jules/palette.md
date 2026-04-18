## 2026-04-18 - [Missing ARIA labels on Lucide icons]
**Learning:** Found multiple instances where icon-only buttons or links using Lucide icons (`<i data-lucide="...">`) lacked `aria-label` attributes. Without these, screen readers announce nothing or confusing content for essential interactions like opening menus or sending messages. The interface is in Italian, so labels must be localized.
**Action:** When adding or reviewing icon-only interactive elements, ensure an appropriate `aria-label` in Italian is present (e.g., `aria-label="Apri menu"`).
