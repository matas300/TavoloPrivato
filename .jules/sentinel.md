## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2025-02-23 - Prevent Stored XSS in EJS JSON Interpolation
**Vulnerability:** Unescaped `<%- JSON.stringify(...) %>` in EJS templates allows XSS when rendering user-controlled data directly to script tags.
**Learning:** The `<%- ` tag outputs raw, unescaped text. If the JSON data contains `</script>`, it breaks out of the script context and executes arbitrary code.
**Prevention:** Use `<%- (JSON.stringify(data) || 'null').replace(/</g, '\u003c').replace(/>/g, '\u003e') %>` to safely output JSON safely escaped as literal characters for script tags.
