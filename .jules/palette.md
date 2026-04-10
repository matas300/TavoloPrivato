## 2026-04-10 - ARIA Labels in Italian UI
**Learning:** Found multiple icon-only interactive elements (menu toggle, notification bell) in core navigation (`topbar.ejs`) without accessibility labels. Since the application is targeted at Italian users, accessibility strings must be localized appropriately (e.g., "Apri menu principale", "Notifiche") rather than defaulting to English.
**Action:** When adding ARIA labels or screen-reader only text to this project, always match the language context of the surrounding UI (Italian).
