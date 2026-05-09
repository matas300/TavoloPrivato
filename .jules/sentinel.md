## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-09 - Fixed Stored XSS in EJS templates
**Vulnerability:** EJS templates (`<%- JSON.stringify(...) %>`) used to pass data to client-side scripts introduced Stored XSS vulnerabilities.
**Learning:** By directly outputting JSON to `<script>` blocks without escaping, attackers could inject malicious scripts by crafting data containing `</script><script>...`.
**Prevention:** When passing user data to client-side scripts in EJS templates, always ensure characters are properly escaped by using a fallback and double backslashes: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
