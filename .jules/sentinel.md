## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-08 - Fixed Stored XSS vulnerability in EJS templates
**Vulnerability:** EJS templates output raw data passed to client-side scripts using `<%- JSON.stringify(...) %>`, without proper escaping of HTML characters. This allows potential Stored XSS if the data contains malicious `<script>` tags or similar payloads.
**Learning:** In EJS templates, the `<%- ... %>` tag outputs the unescaped raw string. When passing JSON-stringified objects to JavaScript variables inside `<script>` blocks, characters like `<` and `>` must be manually escaped (e.g., using `replace(/</g, '\\u003c')`) so they don't prematurely close the script tag or introduce HTML elements when parsed by the browser.
**Prevention:** Always escape user data passed to client scripts via template engines. Use fallback techniques and explicit character replacement: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
