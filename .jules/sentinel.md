## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2024-04-08 - Fixed Stored XSS in EJS JSON.stringify injections
**Vulnerability:** EJS templates were rendering server-side objects into client-side `<script>` blocks using unescaped `<%- JSON.stringify(data) %>`. This created a Stored XSS vulnerability because user-controlled data containing strings like `</script><script>alert(1)</script>` could break out of the script context and execute arbitrary JavaScript.
**Learning:** In EJS, the `<%-` tag outputs raw HTML without escaping. When passing JSON data to the client, simply stringifying it is not enough to prevent HTML injection if the string contains HTML tag characters (`<`, `>`).
**Prevention:** Always escape HTML tag characters when outputting JSON within `<script>` tags. A robust pattern is `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`. The fallback `|| 'null'` is critical to prevent `TypeError: Cannot read properties of undefined (reading 'replace')` if the data is undefined.
