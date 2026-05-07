## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-05-07 - Fixed Stored XSS via JSON.stringify in EJS
**Vulnerability:** EJS templates using `<%- JSON.stringify(data) %>` can output unsanitized content directly into JavaScript blocks if the user data contains malicious HTML tags like `<script>`.
**Learning:** The `<%- ... %>` tags in EJS output strings directly without HTML escaping, creating a severe Stored XSS vulnerability when passing user-controlled data to client-side scripts via `JSON.stringify()`.
**Prevention:** When passing data from the server to client-side JavaScript via EJS templates, always use a fallback and double backslashes to escape unicode characters safely: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
