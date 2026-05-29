## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2024-05-24 - Prevent XSS in EJS templates
**Vulnerability:** EJS tags passing JSON objects unescaped (`<%- JSON.stringify(...) %>`) could introduce Stored XSS.
**Learning:** Using `<%- JSON.stringify() %>` is unsafe when rendering dynamic content because `<` and `>` are not properly escaped by EJS, allowing code injection.
**Prevention:** Always use a fallback and double backslashes to escape unicode properly: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
