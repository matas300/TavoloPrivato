## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-09 - Fixed Stored XSS vulnerability in EJS templates
**Vulnerability:** User data passed to client-side scripts via `<%- JSON.stringify(...) %>` in EJS templates allows for Stored Cross-Site Scripting (XSS) if the data contains unescaped HTML tags.
**Learning:** By injecting script tags (e.g. `<script>alert(1)</script>`) into fields such as profile names, attackers can execute arbitrary code on the victim's browser when the data is serialized unescaped. The express framework does not automatically escape JSON output in the EJS rendering engine.
**Prevention:** Always ensure characters like `<` and `>` are properly escaped when converting JavaScript objects to JSON inside EJS templates. Example: `<%- JSON.stringify(...).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
