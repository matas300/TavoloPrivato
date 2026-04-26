
## 2024-04-26 - ARIA labels for icon-only buttons and label-less inputs
**Learning:** EJS templates frequently use Lucide icons (`<i data-lucide="...">`) inside `<button>` or `<a>` tags without any visible text. Additionally, input fields like the chat message input often lack an associated `<label>` element. These are inaccessible to screen readers.
**Action:** When implementing or updating icon-only interactive elements or inputs without labels, always include an `aria-label` attribute translated into Italian (e.g., `aria-label="Apri menu"`, `aria-label="Testo del messaggio"`).
