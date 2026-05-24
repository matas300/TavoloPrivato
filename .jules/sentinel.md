## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-05-24 - Fix EJS JSON.stringify Stored XSS
**Vulnerability:** EJS templates directly inject user-controlled data into inline `<script>` tags using `<%- JSON.stringify(data) %>`, which can allow attackers to inject malicious HTML/script tags.
**Learning:** Using the raw output tag `<%- ... %>` disables EJS's HTML escaping, but passing `JSON.stringify` directly can still evaluate HTML characters.
**Prevention:** Use `.replace(/</g, '\u003c').replace(/>/g, '\u003e')` to ensure JSON payloads do not break out of `<script>` contexts or use safe sanitization tools before rendering.
