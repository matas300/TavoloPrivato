## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2024-05-24 - [Stored XSS in EJS templates]
**Vulnerability:** EJS templates using `<%- JSON.stringify(data) %>` injected unescaped data into `<script>` blocks, leading to Stored XSS.
**Learning:** In EJS, `<%-` outputs unescaped raw HTML. When injecting JSON data into a `<script>` tag, any strings containing `</script>` or other HTML tags are rendered directly, allowing an attacker to break out of the script tag and execute arbitrary code.
**Prevention:** Always escape `<` and `>` when using JSON.stringify within HTML `<script>` tags in EJS templates. Use the pattern `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
