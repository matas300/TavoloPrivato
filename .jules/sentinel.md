## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2024-06-12 - Fix XSS in JSON.stringify payload injection
**Vulnerability:** Unescaped user data passed to client-side scripts via EJS `<%- JSON.stringify(...) %>` allows Stored/Reflected XSS.
**Learning:** EJS engine outputs raw characters for `<%- ... %>`. When JSON payload contains HTML tags `<script>`, it breaks out of the context.
**Prevention:** Ensure characters are properly escaped by using a fallback and double backslashes so the template engine literally outputs the unicode to the client's source code: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`
