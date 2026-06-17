## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2024-05-18 - EJS JSON.stringify XSS
**Vulnerability:** EJS templates use `<%- JSON.stringify(data) %>` inside `<script>` blocks, leading to Stored XSS if `data` contains `</script>`.
**Learning:** This is a codebase-specific pattern where server-side data is directly passed to the client without escaping `<` and `>` characters, bypassing normal HTML sanitization.
**Prevention:** Always wrap `JSON.stringify` with `.replace(/</g, '\u003c').replace(/>/g, '\u003e')` when injecting inside script blocks.
