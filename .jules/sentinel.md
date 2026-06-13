## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-09 - Fixed Stored XSS via JSON.stringify in EJS templates
**Vulnerability:** EJS templates use `<%- JSON.stringify(...) %>` to pass dynamic variables to client-side scripts. The `<%-` tag outputs raw HTML, allowing injected `<script>` tags inside JSON payloads to execute, leading to Stored XSS.
**Learning:** Whenever injecting server-side variables directly into `<script>` blocks via EJS, the raw output tag `<%-` must be used (otherwise `&lt;` breaks JS), but raw output is inherently unsafe if the JSON contains HTML tags.
**Prevention:** Always escape HTML entity characters (`<`, `>`) within the stringified JSON output using `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')`. Ensure the fallback uses double backslashes so the `.ejs` file correctly contains `\u003c`.
