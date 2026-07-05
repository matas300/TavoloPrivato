## $(date +%Y-%m-%d) - Adding ARIA labels to icon-only buttons
**Learning:** In the navigation and topbar components (e.g., `views/partials/topbar.ejs`), several interactive elements like the sidebar menu toggle and the notification bell rely purely on Lucide icons without accessible text. This makes their purpose unclear to users relying on screen readers.
**Action:** When working on navigation or icon-heavy interfaces, always explicitly verify that `<button>` and `<a>` elements containing only icons have descriptive `aria-label` attributes in Italian matching the localized interface.
