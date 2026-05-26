
## 2024-05-24 - [Fix Stored XSS in EJS Templates]
**Vulnerability:** EJS templates use `<%- JSON.stringify(...) %>` to pass server-side data directly to client-side scripts.
**Learning:** Using the raw output tag `<%- ... %>` with `JSON.stringify` introduces a Stored Cross-Site Scripting (XSS) vulnerability. If the data contains `<script>` tags or malicious HTML, it gets executed directly by the browser because the `<%- ... %>` tag does not escape the output.
**Prevention:** Always escape data being passed from the server to client-side scripts in EJS. When using `<%- ... %>`, apply `(JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e')` so that HTML brackets are encoded. Alternatively, safely output inside `<script>` blocks using proper HTML entity encoding or pass data via `data-*` attributes on HTML elements that are read by the client.
