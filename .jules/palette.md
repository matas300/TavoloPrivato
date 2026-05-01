## 2026-05-01 - Icon-only buttons and inputs lacking labels
**Learning:** Discovered that icon-only interactive elements (like the menu toggle, notification bell, and send message button) and placeholder-only inputs (like the chat input) lack necessary ARIA labels for screen reader support in this application's EJS templates. Since the application is in Italian, these labels must be localized.
**Action:** Add localized Italian 'aria-label' attributes to any interactive element that relies solely on Lucide icons or lacks an associated '<label>' tag.
