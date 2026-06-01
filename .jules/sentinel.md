## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-05-18 - Fixed Stored XSS in EJS Templates
**Vulnerability:** EJS templates output user-controlled JSON data directly via `<%- JSON.stringify(...) %>` which is susceptible to HTML injection and Stored XSS.
**Learning:** Using raw EJS output tag (`<%-`) for JSON exposes the application to XSS attacks since the output can break out of JSON/string contexts and insert script tags in the page source.
**Prevention:** Always escape JSON injected into HTML templates using double backslashes in Javascript string replacements, e.g., `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
