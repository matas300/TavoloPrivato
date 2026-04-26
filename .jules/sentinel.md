## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-04-26 - [Fix Stored XSS in EJS Templates]
**Vulnerability:** EJS templates generated dynamic script blocks using `JSON.stringify` directly into the DOM (e.g., `<%- JSON.stringify(data) %>`) without escaping HTML characters, which allowed Stored XSS if `data` contained unsanitized user inputs.
**Learning:** Even though `JSON.stringify` serializes objects safely into valid JSON format, putting it inside an HTML `<script>` block requires replacing `<` and `>` into `\u003c` and `\u003e` to prevent breaking out of the script tag and executing arbitrary code.
**Prevention:** Use `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')` whenever rendering JSON directly into a script tag using EJS.
