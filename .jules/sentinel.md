## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2025-02-23 - [Preventing XSS in EJS Script Tags]
**Vulnerability:** Unescaped `<%- JSON.stringify(data) %>` inside `<script>` tags allows Stored XSS if the data contains `</script>`.
**Learning:** EJS `<%- ... %>` outputs raw strings, so Node.js evaluating JSON strings containing HTML tags can break the JavaScript context.
**Prevention:** Always escape `<` and `>` in JSON strings when interpolating them into HTML templates by using `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')`.
