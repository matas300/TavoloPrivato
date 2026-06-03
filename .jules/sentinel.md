## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2024-05-15 - Fixed Stored XSS in EJS Templates
**Vulnerability:** EJS templates used `<%- JSON.stringify(...) %>` to pass data to client-side scripts, exposing Stored XSS vulnerabilities by allowing unsanitized `<script>` tags or HTML inside the JSON structure.
**Learning:** Found multiple instances where user data or data models were stringified inside unescaped EJS output tags (`<%-`). This allows attackers to execute cross-site scripting attacks if the data contains HTML closing tags or malicious scripts.
**Prevention:** Always use fallback and unicode escape replacement when stringifying JSON in EJS templates: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>` to prevent the browser from interpreting string contents as HTML.
