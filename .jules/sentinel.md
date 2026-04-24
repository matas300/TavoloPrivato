## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-10 - Fixed Stored XSS in EJS Templates
**Vulnerability:** EJS templates using `<%- JSON.stringify(data) %>` are vulnerable to Stored XSS if `data` contains unescaped HTML characters like `<` and `>`.
**Learning:** Passing user data to client-side scripts via JSON.stringify without escaping characters like `<` and `>` allows attackers to execute malicious scripts in the context of the user's browser, leading to XSS.
**Prevention:** Always escape HTML characters when embedding JSON in HTML. Use `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')` on the output of `JSON.stringify()`.
