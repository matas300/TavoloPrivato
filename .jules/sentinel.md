## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-05-16 - Fixed Stored XSS in EJS templates
**Vulnerability:** EJS templates passing unescaped user data directly into \`<script>\` blocks using \`<%- JSON.stringify(data) %>\`.
**Learning:** EJS \`<%-\` outputs raw, unescaped strings. If \`JSON.stringify\` is used with user-controlled input, it can include \`</script><script>alert(1)</script>\` and break out of the script block to execute arbitrary JS in the user's browser, leading to Stored XSS.
**Prevention:** When embedding JSON into script blocks in EJS, always escape HTML characters: \`<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>\`.
