## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-08 - Fixed Stored XSS in EJS templates
**Vulnerability:** Unescaped `<%- JSON.stringify(data) %>` usage in EJS templates injected data directly into client-side scripts.
**Learning:** When passing data via `JSON.stringify` to `<script>` blocks using EJS `<%- ... %>` tags, the HTML tags inside the JSON string are not escaped by default, enabling Stored XSS.
**Prevention:** Always escape HTML tags when using `JSON.stringify` within EJS templates by chaining `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')`.
