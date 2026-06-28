## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2024-05-24 - Stored XSS via JSON in EJS
**Vulnerability:** Unescaped `<%- JSON.stringify(data) %>` in `<script>` blocks allows Stored XSS if data contains `</script><script>malicious()</script>`.
**Learning:** Single-backslash `\u003c` in JS replacements evaluated to `<` before parsing; we need `\\u003c`.
**Prevention:** Always use `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')` on JSON strings injected into `<script>` contexts.
