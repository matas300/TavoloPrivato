## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2024-05-28 - Prevent Stored XSS in EJS inline scripts
**Vulnerability:** Unescaped `<%- JSON.stringify(var) %>` output in EJS templates inside `<script>` blocks can be exploited to perform Stored XSS by injecting malicious characters like `<script>` or `</script>`.
**Learning:** EJS provides `<%- ... %>` to output unescaped HTML, which is often used incorrectly to inline JSON objects directly into JavaScript via `JSON.stringify`. When user-controlled data is included in the stringified JSON, the unescaped output allows attackers to break out of the script context.
**Prevention:** Always escape JSON data injected into inline scripts by replacing characters such as `<` and `>` with their unicode escape sequence representations: `<%- (JSON.stringify(var) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
