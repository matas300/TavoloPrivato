## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-05-01 - Prevent Stored XSS in EJS JSON.stringify outputs
**Vulnerability:** EJS templates using `<%- JSON.stringify(...) %>` to pass server-side data to client-side scripts were vulnerable to Stored XSS if the data contained unescaped HTML characters (`<`, `>`).
**Learning:** EJS `<%- %>` tag renders unescaped HTML. While JSON.stringify escapes quotes and some control characters, it does not escape HTML brackets by default. This leaves the resulting string vulnerable to XSS when interpreted by the browser.
**Prevention:** Always append `.replace(/</g, '\u003c').replace(/>/g, '\u003e')` to `JSON.stringify` outputs within `<%- %>` tags when rendering data inside script tags in EJS templates.
