## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2024-05-13 - Fixed Stored XSS via JSON.stringify in EJS Templates
**Vulnerability:** EJS templates using `<%- JSON.stringify(...) %>` directly render user-controlled data into inline `<script>` tags, making the application vulnerable to Stored XSS if the data contains malicious payloads (e.g. `</script><script>alert(1)</script>`).
**Learning:** Even though `JSON.stringify` produces valid JSON, it does not escape HTML control characters like `<` and `>`. When this unescaped JSON is rendered in an EJS template within a `<script>` tag using `<%- ... %>`, the browser can misinterpret the JSON content as HTML/JavaScript, allowing arbitrary script execution.
**Prevention:** Always escape HTML control characters when serializing data for inclusion in inline scripts. Use the pattern `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>` to ensure special characters are safely encoded as unicode escapes.
