## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-05-20 - [Fix Stored XSS via JSON.stringify in EJS Templates]
**Vulnerability:** Passing user-controlled data to client-side scripts using `<%- JSON.stringify(data) %>` inside EJS templates allows Stored XSS since `<%- ... %>` does not escape HTML output. If data contains `</script><script>alert(1)</script>`, the inline script terminates and the malicious payload runs.
**Learning:** EJS `<%- %>` outputs strings raw. By directly dropping stringified JSON objects containing untrusted input into inline scripts, an injection vector is created.
**Prevention:** When passing JSON inside `<script>` blocks with EJS, always escape `<` and `>` characters to their unicode representations. Use the pattern: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
