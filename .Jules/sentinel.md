## 2024-05-18 - XSS in EJS Inline Scripts
**Vulnerability:** EJS templates were passing unescaped data to inline JavaScript via `<%- JSON.stringify(data) %>`, which allows for Stored XSS if `data` contains malicious user input like `</script><script>alert(1)</script>`.
**Learning:** Even within `<script>` tags, EJS `<%- %>` outputs raw HTML, meaning a crafted string can break out of the string literal and script tag.
**Prevention:** Always escape JSON data injected into scripts using a safe fallback and unicode escapes: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
