## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2025-02-18 - XSS in EJS Templates via JSON.stringify
**Vulnerability:** EJS templates using `<%- JSON.stringify(data) %>` inside `<script>` tags without proper escaping were vulnerable to Stored/Reflected XSS.
**Learning:** Using the unescaped output tag `<%-` combined with `JSON.stringify` directly in inline scripts allows attackers to inject malicious HTML or script tags if the data contains unescaped characters like `<` and `>`.
**Prevention:** Always escape `<` and `>` characters when interpolating JSON objects into JavaScript blocks using `.replace(/</g, '\u003c').replace(/>/g, '\u003e')`.
