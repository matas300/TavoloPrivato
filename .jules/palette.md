
## 2024-05-03 - Standardized Italian ARIA Labels for Icon-Only Buttons and Inputs
**Learning:** Found that layout components (like the topbar menu and bell icon) and chat interfaces (send message button and chat input) lacked specific `aria-label`s or explicit labels, making them challenging for screen reader users, especially in an Italian UI context.
**Action:** Always verify that all icon-only buttons and input fields (even if they have placeholders) are accompanied by appropriate localized `aria-label`s, and that interior structural icons use `aria-hidden="true"`.
