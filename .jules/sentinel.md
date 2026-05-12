## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2025-02-28 - EJS Stored XSS Vulnerability
**Vulnerability:** EJS templates passing server-side variables directly to client-side `<script>` blocks using `<%- JSON.stringify(...) %>` were vulnerable to Stored XSS. Attackers could break out of the string context by injecting `</script>` tags into serialized data.
**Learning:** `JSON.stringify` does not encode angle brackets (`<`, `>`). When its raw output is embedded in HTML templates within `<script>` tags, malicious strings containing valid HTML tags are processed by the browser as markup before the JavaScript engine parses the block.
**Prevention:** Always escape JSON data passed to `<script>` blocks in EJS templates. Use a fallback and double backslashes to literalize the unicode so the template engine outputs it safely: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
