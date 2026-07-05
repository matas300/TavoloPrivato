## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2025-02-27 - Escape JSON.stringify in EJS Templates
**Vulnerability:** Stored XSS via unescaped JSON.stringify inside `<script>` tags in EJS templates.
**Learning:** EJS's raw output tag `<%- ... %>` does not escape HTML. When injecting JSON data directly into client-side scripts, if the data contains `</script>`, it allows an attacker to break out of the script block and execute arbitrary code. Replacing `<` with single-escaped Unicode (`\u003c`) is ineffective in JS context as it resolves back to `<` before parsing; double escaping (`\\u003c`) is required to output literal Unicode.
**Prevention:** Always append `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')` when injecting JSON into EJS `<script>` tags, and use a fallback `(JSON.stringify(data) || 'null')` to prevent server rendering crashes on undefined data.
