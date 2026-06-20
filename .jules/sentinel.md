## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-06-20 - Prevent XSS in EJS JSON.stringify
**Vulnerability:** EJS templates using `<%- JSON.stringify(...) %>` directly inject JSON strings into HTML script tags. If the JSON contains user input like `</script><script>alert(1)</script>`, it can break out of the script block and execute arbitrary code, leading to XSS.
**Learning:** Even though `JSON.stringify` creates valid JSON, it doesn't escape HTML tags (`<`, `>`). Since EJS's `<%\-` tag outputs raw, unescaped strings, this combination is inherently unsafe.
**Prevention:** When passing JSON to client-side scripts via EJS, always escape HTML characters. The proper pattern is `<%- (JSON.stringify(data) || 'null').replace(/</g, '\\\\u003c').replace(/>/g, '\\\\u003e') %>` which replaces the literal angle brackets with unicode escape sequences interpreted by JS.
