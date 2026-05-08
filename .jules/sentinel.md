## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-09 - Fixed Stored XSS in EJS Templates
**Vulnerability:** EJS templates passing unescaped user data to client-side scripts via `<%- JSON.stringify(...) %>`. This allows attackers to inject malicious HTML/scripts if the data contains unescaped `<` or `>` characters, leading to Stored XSS when the browser renders the page.
**Learning:** `JSON.stringify` alone does not escape HTML characters (`<`, `>`). When used with the raw output tag `<%- %>` in EJS to assign JSON data to a script variable, any HTML tags within the JSON strings are parsed by the browser, allowing attackers to break out of the script tag and execute arbitrary code.
**Prevention:** Always escape data when passing it to client-side scripts using a fallback and string replacement: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
