## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-09 - Prevent Stored XSS via EJS JSON.stringify
**Vulnerability:** EJS templates using `<%- JSON.stringify(...) %>` directly embedded user-controlled data into `<script>` blocks without escaping HTML characters. This creates a Stored XSS vulnerability because attackers can insert payloads like `</script><script>alert(1)</script>` into data fields that are later stringified in EJS views.
**Learning:** Even when passing serialized objects to frontend JavaScript variables, rendering them using EJS unescaped tags (`<%-`) exposes the system to injection if the object strings contain unescaped HTML characters.
**Prevention:** Always sanitize `JSON.stringify` outputs inside EJS templates by replacing potentially dangerous characters such as `<` and `>` with their Unicode escape sequences (e.g. `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')`), or by using an established secure serialization library designed to output safe JavaScript variables inside HTML.
