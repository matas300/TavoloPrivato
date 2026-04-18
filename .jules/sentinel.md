## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-18 - Fix XSS in JSON data injection
**Vulnerability:** XSS vulnerability through unescaped JSON strings in EJS templates inside `<script>` tags. EJS outputs the raw string, meaning an attacker could craft malicious user input (like a `</script><script>alert(1)</script>` tag) that executes when injected into a page.
**Learning:** `JSON.stringify` does not escape HTML characters by default. Using `<%- JSON.stringify(data) %>` inside `<script>` blocks is unsafe when `data` includes user input.
**Prevention:** Always escape `<` characters in JSON intended for script contexts using `.replace(/</g, '\\u003c')`.
