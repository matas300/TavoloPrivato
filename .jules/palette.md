## 2026-04-15 - ARIA Labels for Icon-Only Navigation Elements
**Learning:** Icon-only elements like hamburger menus and notification bells in global navigation patterns are frequently overlooked for accessibility. Without `aria-label`s, screen readers announce these as empty or 'link/button', severely degrading navigation usability.
**Action:** Always verify that every icon-only interactive element in standard layouts (topbars, sidebars, navbars) has a descriptive `aria-label` localized to the application's language (e.g., Italian).
