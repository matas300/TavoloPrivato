## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2024-05-24 - Fixed Stored XSS via JSON stringification in EJS templates
**Vulnerability:** User data or objects were injected into `<script>` blocks using `<%- JSON.stringify(data) %>`. Because `<%-` renders without escaping HTML characters, an attacker could include `</script><script>alert(1)</script>` in the user data to execute arbitrary JS in the victim's browser (Stored XSS).
**Learning:** Even inside `<script>` blocks, EJS `<%-` direct injection is unsafe if it contains user-controlled content, as browsers will evaluate the literal string `</script>` and end the script tag early.
**Prevention:** Always escape `<` and `>` characters by replacing them with their unicode equivalents (`\u003c` and `\u003e`) when embedding JSON inside a `<script>` tag using EJS, such as: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>`.
