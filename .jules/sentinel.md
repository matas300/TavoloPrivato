## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2025-02-24 - [Fix Stored XSS in EJS Templates]
**Vulnerability:** EJS templates use `<%- JSON.stringify(data) %>` to pass server-side data to client-side scripts, which can allow Stored XSS if the data contains unescaped HTML characters like `<script>`.
**Learning:** EJS's `<%-` outputs unescaped HTML. Using `JSON.stringify` inside `<%-` without proper encoding allows any strings within the JSON (including user input) to be interpreted as HTML/JavaScript by the browser.
**Prevention:** Always encode `<` and `>` characters when passing JSON data to client-side scripts in EJS templates: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
