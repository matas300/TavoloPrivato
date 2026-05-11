## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2025-05-11 - Fixed Stored XSS in EJS Templates
**Vulnerability:** EJS templates (`<%- JSON.stringify(...) %>`) used raw unescaped JSON string interpolation to pass mock and database data into the DOM context.
**Learning:** Using raw `<%- ... %>` to dump user data directly into `<script>` tags creates a severe Stored XSS vulnerability because attackers can insert closing `</script>` tags or other payload within strings that get executed by the browser when parsing the inline scripts.
**Prevention:** Always use safe unicode replacements when injecting JSON-stringified payloads into HTML templates to prevent breaking the script context: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
