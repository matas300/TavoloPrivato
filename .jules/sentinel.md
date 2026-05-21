## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-05-21 - Fixed Stored XSS in EJS Templates
**Vulnerability:** Found unescaped user data being injected directly into EJS templates inside script tags via `<%- JSON.stringify(data) %>`. This allows attackers to perform Stored Cross-Site Scripting (XSS) attacks.
**Learning:** EJS provides a way to output unescaped raw HTML using `<%- ... %>`, which is frequently used to inject JSON configuration/data to client-side scripts. Since JSON strings might contain malicious characters like `<` and `>`, they must be properly escaped so the template engine outputs safe unicode.
**Prevention:** Whenever passing data into client-side scripts via EJS, ensure characters are properly escaped by using a fallback and double backslashes so the template engine literally outputs the unicode to the client's source code: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
