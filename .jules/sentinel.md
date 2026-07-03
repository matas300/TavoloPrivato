## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2024-05-24 - Stored XSS via EJS JSON.stringify injection
**Vulnerability:** XSS vulnerability where unescaped `<%- JSON.stringify(data) %>` was injected directly into `<script>` blocks in EJS templates.
**Learning:** JavaScript engines evaluate `\\u003c` in strings, so in EJS templates, backslashes must be double-escaped `\\\\u003c` when applying `.replace()` during stringification to prevent breaking script context or evaluating XSS payloads before HTML parsing.
**Prevention:** Always append `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')` with double backslashes to EJS `JSON.stringify` calls injected inside script tags.
