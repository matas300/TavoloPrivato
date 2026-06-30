## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-04-09 - Prevented Stored XSS in EJS Templates via JSON.stringify
**Vulnerability:** Injecting data directly into EJS scripts using `<%- JSON.stringify(data) %>` exposes the application to Cross-Site Scripting (XSS) if the data contains unescaped malicious scripts (e.g. `<script>alert(1)</script>`).
**Learning:** In JavaScript, single escaping backslashes inside `replace()` evaluate directly into HTML. You must use double backslashes in `.replace(/</g, '\\u003c')` so that EJS outputs literal unicode escape sequences instead of executing the HTML.
**Prevention:** Always escape `<` and `>` with literal unicode (`\\u003c` and `\\u003e`) when passing serialized JSON to frontend scripts using EJS.
