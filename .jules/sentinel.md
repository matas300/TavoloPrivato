## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2024-05-18 - Fixed Stored XSS in EJS templates via JSON.stringify
**Vulnerability:** XSS vulnerability through unescaped `JSON.stringify` usage in EJS raw output tags (`<%- ... %>`).
**Learning:** EJS templates outputting user data directly to script tags via `<%- JSON.stringify(data) %>` can introduce XSS since attackers can include `</script><script>...` in the payload, which breaks out of the JavaScript context and is executed by the browser.
**Prevention:** Always escape characters when passing JSON data to client-side scripts inside templates: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
