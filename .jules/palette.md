
## 2026-07-02 - Icon-only buttons accessibility missing ARIA labels
**Learning:** Found that multiple icon-only buttons (like menu toggle and notification bells) and some input fields lacked `aria-label` attributes. This is a common accessibility issue that prevents screen reader users from understanding the purpose of interactive elements.
**Action:** Added `aria-label` attributes using Italian ("Apri menu", "Notifiche", "Scrivi un messaggio") to match the application's localization. In the future, I will always check icon-only buttons for missing ARIA labels as part of my initial observation phase.
