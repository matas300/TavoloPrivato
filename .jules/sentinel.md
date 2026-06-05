## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-04-09 - Fixed Stored XSS in EJS JSON serialization
**Vulnerability:** EJS templates injecting user data into script tags using `<%- JSON.stringify(...) %>` allowed for Stored XSS.
**Learning:** In EJS, `<%- ... %>` renders raw unescaped HTML. Passing JSON directly into script tags inside a view without escaping HTML-sensitive characters (`<` and `>`) allows an attacker to break out of the script tag by injecting `</script><script>alert(1)</script>`.
**Prevention:** When passing JSON to client-side scripts, ensure characters are properly escaped by replacing them so they safely output unicode to the client's source code: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
