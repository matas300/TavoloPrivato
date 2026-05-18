## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## $(date +%Y-%m-%d) - [Stored XSS in EJS Templates]
**Vulnerability:** Unescaped `<%- JSON.stringify(...) %>` expressions in EJS templates (e.g. `simulatore-guadagno.ejs`, `pagamenti.ejs`, `contratti-lunghi.ejs`) allow attackers to break out of script blocks and inject malicious HTML/JS payloads.
**Learning:** In EJS, placing unescaped JSON inside `<script>` blocks can expose the app to Stored XSS. Browsers parse `<script>` contents as HTML first, meaning a string like `</script><script>alert(1)</script>` within the JSON will prematurely close the script block and execute the payload.
**Prevention:** When injecting JSON data into `<script>` tags using EJS, always escape the `<` and `>` characters directly in the output string. Use a pattern like: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
