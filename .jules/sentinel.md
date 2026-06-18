## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2025-03-09 - Cross-Site Scripting via JSON.stringify in EJS Templates
**Vulnerability:** Unsafe injection of JavaScript objects into HTML using `<%- JSON.stringify(data) %>` in inline script tags, allowing DOM-based XSS if the data contains `</script>`.
**Learning:** EJS `<%- %>` outputs raw strings, so `JSON.stringify` does not escape HTML control characters like `<` or `>`.
**Prevention:** Replace with `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>` to ensure strings are valid JSON but cannot break out of `<script>` blocks.
