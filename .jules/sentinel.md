## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2024-06-19 - Fixed Stored XSS via EJS and innerHTML
**Vulnerability:** EJS templates directly rendering JSON via `<%- JSON.stringify(...) %>` and Javascript injecting properties into the DOM via `innerHTML` without HTML escaping.
**Learning:** This allows Stored XSS where user input can execute malicious scripts on the frontend. The `JSON.stringify` within an unescaped EJS tag outputs raw HTML-sensitive characters (`<`, `>`, etc.). Client-side `.innerHTML` rendering lacked wrapping variables with an `escapeHtml` function, putting user inputs directly into the DOM tree.
**Prevention:** Always use `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>` for inline JSON rendering to safely handle `<` and `>` tags. Always use an `escapeHtml` wrapper function for string interpolated into `innerHTML` statements within frontend logic.
