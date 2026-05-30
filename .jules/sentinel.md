## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2023-10-27 - Prevent Stored XSS in EJS Templates
**Vulnerability:** EJS templates use `<%- JSON.stringify(data) %>` to pass data to client-side scripts, which can lead to Stored XSS if the data contains malicious `<script>` tags or similar HTML characters.
**Learning:** The raw output tag `<%- ... %>` in EJS does not escape HTML. When outputting JSON strings directly into inline scripts, attackers can inject HTML elements or scripts.
**Prevention:** When passing JSON to the client via EJS, ensure characters like `<` and `>` are escaped safely by replacing them with their Unicode equivalents. Use the pattern `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
