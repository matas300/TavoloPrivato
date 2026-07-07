## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.

## 2026-04-08 - Fixed Stored XSS in EJS JSON.stringify
**Vulnerability:** EJS templates use `<%- JSON.stringify(data) %>` to pass data to client-side scripts. This allows Stored XSS if the data contains malicious HTML/JS tags, because `JSON.stringify` does not escape `<` and `>`.
**Learning:** When passing JSON to the client in EJS templates inside `<script>` blocks, the raw characters `<` and `>` can prematurely close the script tag and inject malicious payloads.
**Prevention:** Always escape `<` and `>` when injecting JSON into `<script>` tags by replacing them with their Unicode representations (`\u003c` and `\u003e`). Use: `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>`.
