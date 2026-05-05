## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-05-05 - Fix Stored XSS in EJS Templates
**Vulnerability:** EJS templates in the project frequently use `<%- JSON.stringify(...) %>` to pass data to client-side scripts, which introduces Stored XSS vulnerabilities.
**Learning:** If the user-supplied data contains `</script><script>alert(1)</script>`, the unescaped template will execute the payload on the client side.
**Prevention:** When passing user data this way, ensure characters are properly escaped by using a fallback and double backslashes so the template engine literally outputs the unicode to the client's source code: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
