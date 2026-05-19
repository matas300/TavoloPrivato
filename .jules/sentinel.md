## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-05-19 - Prevent Stored XSS in EJS JSON Serialization
**Vulnerability:** EJS templates passing server variables to client-side JavaScript via `<%- JSON.stringify(...) %>` were vulnerable to Stored XSS. If user-controlled data contained `</script><script>...`, it broke out of the `<script>` block before JavaScript evaluation, executing arbitrary code.
**Learning:** Standard JSON stringification does not escape HTML control characters (`<` and `>`), meaning it is inherently unsafe to inject inside HTML `<script>` tags when utilizing raw output interpolations (`<%- ... %>`).
**Prevention:** Always serialize data inside scripts using `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>` to ensure HTML characters are safely converted to Unicode escape sequences.
