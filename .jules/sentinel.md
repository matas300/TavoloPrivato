## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-08 - Fixed Stored XSS via JSON.stringify in EJS templates
**Vulnerability:** Unescaped JSON rendering in EJS templates allowing Stored XSS.
**Learning:** Using `<%- JSON.stringify(data) %>` inside `<script>` blocks in EJS templates directly injects the JSON string into HTML. If `data` contains user-controlled strings like `</script><script>alert(1)</script>`, it terminates the script tag and executes arbitrary code, creating a critical Stored XSS vulnerability.
**Prevention:** Always escape angle brackets when embedding JSON in HTML. Use `.replace(/</g, '\\u003c')` after `JSON.stringify` to neutralize script tags within the data payload while keeping it valid JSON.