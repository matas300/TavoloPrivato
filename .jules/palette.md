## 2024-05-18 - Add ARIA labels to icon-only buttons
**Learning:** Found multiple instances where Lucide icon-only buttons (menu toggles, notification bells, send buttons) lacked accessible textual names, making them unreadable for screen readers. Using Italian translations ("Invia messaggio", "Apri menu") is crucial here to match the localization context of the app.
**Action:** Always ensure any `<button>` or `<a>` tag that relies solely on an icon class or SVG for visuals has a descriptive `aria-label` attribute in Italian.
