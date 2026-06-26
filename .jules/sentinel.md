## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2024-06-26 - EJS JSON Serialization XSS
**Vulnerability:** Stored/Reflected XSS via `<%- JSON.stringify(data) %>` inside `<script>` blocks in EJS templates.
**Learning:** EJS evaluates `<%-` raw strings without HTML escaping. If `data` contains `</script><script>alert(1)</script>`, it breaks out of the script tag before the JS engine parses the JSON.
**Prevention:** Use double backslashes for unicode replacement: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
