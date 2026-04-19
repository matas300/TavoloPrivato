## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-09 - Fix Stored XSS in EJS JSON serialization
**Vulnerability:** User data serialized into client-side scripts via `<%- JSON.stringify(...) %>` allows Stored Cross-Site Scripting (XSS) if unescaped HTML characters are present.
**Learning:** EJS `<%\-` tags output unescaped HTML. Directly injecting JSON strings containing user data into `<script>` blocks allows malicious users to break out of the string context using tags like `</script>`.
**Prevention:** Always escape HTML-sensitive characters (like `<`) when serializing data to be parsed within script blocks. For JSON stringify, append `.replace(/</g, '\u003c')`.
