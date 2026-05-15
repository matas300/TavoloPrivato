## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2025-02-14 - Fix Stored XSS in EJS Templates via JSON.stringify
**Vulnerability:** EJS templates used `<%- JSON.stringify(...) %>` directly inside `<script>` blocks to pass data to the client, exposing the application to Stored XSS if the data contained stringified HTML tags like `</script>`.
**Learning:** Using `JSON.stringify` directly in templates can allow arbitrary script execution if the output contains characters like `<` and `>`.
**Prevention:** Always escape characters when passing JSON to client scripts within templates, utilizing a fallback and regex to replace dangerous characters: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
