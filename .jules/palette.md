## 2023-10-27 - Icon-only buttons lack ARIA labels
**Learning:** Many interactive elements across the platform (such as menu toggles, notification bells, and chat send buttons) are icon-only and lack `aria-label`s, which makes navigation difficult for screen readers. Inputs in custom components like the chat input also lacked `<label>` tags.
**Action:** Always verify that buttons or links containing only `<i data-lucide="...">` have an explicit, localized `aria-label` (e.g., in Italian) and that inputs have a visible `<label>` or an `aria-label`.
