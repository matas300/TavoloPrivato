## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-05-10 - Fix Stored XSS in EJS JSON output
**Vulnerability:** Passing unescaped server-side JSON directly into client-side `<script>` tags using `<%- JSON.stringify(...) %>` in EJS templates allows potential Stored XSS attacks, as an attacker could insert closing `</script>` tags within the JSON data.
**Learning:** EJS's `<%- ... %>` tag outputs raw, unescaped HTML. When embedding JSON data within `<script>` blocks, the default `JSON.stringify` does not escape HTML entities, making it vulnerable if the data contains user input.
**Prevention:** Always escape HTML entities within JSON data embedded in `<script>` tags when using EJS. Use a replace function like `<%- (JSON.stringify(...) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>` to ensure safe output.
