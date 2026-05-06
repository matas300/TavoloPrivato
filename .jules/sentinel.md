## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2024-05-18 - XSS via Unescaped JSON in EJS Templates
**Vulnerability:** EJS templates using `<%- JSON.stringify(data) %>` inside `<script>` blocks can be exploited to inject arbitrary HTML or JavaScript (Stored XSS) if the data contains malicious characters like `<` or `>`.
**Learning:** Even within `<script>` tags, EJS `<%- ... %>` renders raw strings that the browser interprets as HTML before parsing as JavaScript, allowing premature closing of script tags and code execution.
**Prevention:** Always escape JSON data passed to the client via EJS by replacing `<` and `>` with their unicode equivalents: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
