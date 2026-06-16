## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-09 - Fixed Stored XSS via JSON.stringify in EJS Templates
**Vulnerability:** EJS templates used `<%- JSON.stringify(...) %>` directly in inline scripts, creating a Stored XSS vulnerability. Attackers could inject arbitrary code if user-supplied input contained the `</script>` string or other HTML escaping elements.
**Learning:** Raw JSON interpolation inside `<script>` tags without proper HTML escaping allows break-out and cross-site scripting vulnerabilities. The raw output tag `<%- ... %>` disables automatic escaping that EJS uses for `<%= ... %>`.
**Prevention:** To safely interpolate JSON into scripts, replace instances of `<` and `>` with their unicode representation using double backslashes when calling `.replace()`. E.g.: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
