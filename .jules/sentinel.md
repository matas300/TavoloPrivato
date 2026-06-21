## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2024-06-21 - Fixed XSS vulnerability in EJS templates due to JSON.stringify
**Vulnerability:** EJS templates used `<%- JSON.stringify(data) %>` inside `<script>` blocks, which allows injection of HTML closing tags (e.g., `</script>`) via user-controlled data, leading to Stored XSS.
**Learning:** Using raw output tags (`<%-`) with `JSON.stringify` is dangerous because the output is directly injected into the page source without escaping.
**Prevention:** Always escape `<` and `>` characters when injecting JSON data into `<script>` blocks within EJS templates. Use `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>` to ensure safe interpolation.
