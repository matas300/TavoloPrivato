## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-06-25 - XSS Vulnerability in EJS templates and client side innerHTML
**Vulnerability:** EJS templates use `<%- JSON.stringify(...) %>` directly on the page, and client side Javascript injects variables directly into `.innerHTML`.
**Learning:** These practices allow for Cross-Site Scripting (XSS). EJS variables are evaluated when the page is parsed, meaning unescaped unicode such as `<script>` will execute. Also injecting unescaped variables into `.innerHTML` allows attackers to run scripts.
**Prevention:** Ensure variables inside EJS tags are escaped by replacing `<` with `\u003c` and `>` with `\u003e`. When using `.innerHTML` on the frontend, pass all user-controlled variables through an `escapeHtml` function that replaces problematic characters with their HTML entities.
