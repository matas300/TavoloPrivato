## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-04-09 - Prevented Stored XSS in EJS Templates
**Vulnerability:** EJS templates were passing user data to client-side scripts using `<%- JSON.stringify(...) %>` without escaping HTML characters, creating a Stored XSS vulnerability.
**Learning:** When passing JSON strings directly into `<script>` tags via EJS, the `<%-` syntax does not escape characters. An attacker could inject `</script><script>alert(1)</script>` within stringified JSON to execute arbitrary JavaScript on the client side.
**Prevention:** Always escape characters like `<` and `>` when stringifying JSON for client-side scripts (e.g., `<%- JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`).
