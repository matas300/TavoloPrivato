## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2024-06-24 - Fixed Stored XSS in EJS JSON.stringify
**Vulnerability:** EJS templates using `<%- JSON.stringify(data) %>` inside `<script>` blocks were vulnerable to Stored XSS because malicious data could contain `</script><script>alert(1)</script>` which would break out of the script block.
**Learning:** In Javascript inside HTML `<script>` tags, replacing `<` with `\u003c` is the standard way to prevent script injection without breaking JSON structure. But in EJS, when injecting strings, you need to be careful to escape properly. We must use literal unicode escapes using double backslashes `.replace(/</g, '\\u003c')`.
**Prevention:** Always escape `<` and `>` when injecting JSON into `<script>` blocks using `<%- (JSON.stringify(data) || "null").replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
