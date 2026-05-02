## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2025-02-27 - Fixed XSS vulnerability in EJS templates
**Vulnerability:** Found unescaped user data passed into `<script>` tags via `<%- JSON.stringify(data) %>`. This allows attackers to perform Cross-Site Scripting (XSS) by injecting `<script>` tags inside JSON strings.
**Learning:** Using `<%-` in EJS outputs raw, unescaped HTML. While JSON.stringify outputs valid JSON, it does not escape HTML control characters like `<` and `>`. When this data is placed directly inside a `<script>` tag, a malicious user can break out of the string context by supplying a payload like `</script><script>alert(1)</script>`.
**Prevention:** Whenever serializing JSON within an HTML context in EJS (or similar templating engines), ensure HTML control characters are explicitly escaped. E.g. append `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')` to the stringified output.
