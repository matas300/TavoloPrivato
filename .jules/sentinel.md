## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-04-29 - [XSS] Unescaped HTML in JSON.stringify
**Vulnerability:** EJS templates passing data to the frontend via `<%- JSON.stringify(data) %>` expose Stored XSS if `data` contains `</script>`.
**Learning:** When generating JSON directly into a script block, angle brackets must be encoded.
**Prevention:** Use `.replace(/</g, '<').replace(/>/g, '>')` when injecting JSON payloads.
