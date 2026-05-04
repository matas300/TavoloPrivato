## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2024-05-04 - Fixed Stored XSS vulnerabilities in EJS templates
**Vulnerability:** User-controlled or complex data objects passed to the client-side JavaScript via `<%- JSON.stringify(...) %>` could lead to Stored XSS. If any object contained malicious HTML/script tags, they were directly evaluated by the browser because EJS directly outputs the raw `<script>` contents when `<%-` is used.
**Learning:** The `<%- JSON.stringify(...) %>` pattern without subsequent escaping exposes the application to XSS when rendering user data in the `script` tags of an EJS template.
**Prevention:** Always escape the serialized output in EJS templates to safely parse it as javascript by using the pattern: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
