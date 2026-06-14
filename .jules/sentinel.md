## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-04-10 - Stored XSS via JSON.stringify in EJS
**Vulnerability:** EJS templates use `<%- JSON.stringify(data) %>` which passes raw data directly into the HTML context. This allows attackers to inject `<script>` tags if the data contains user input.
**Learning:** The `<%-` tag outputs raw HTML. When combined with JSON.stringify, it does not escape HTML characters, making it vulnerable to XSS.
**Prevention:** When injecting JSON data into client-side scripts, always escape HTML tags using `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')` and provide a fallback.
