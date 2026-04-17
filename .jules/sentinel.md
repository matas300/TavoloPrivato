## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-04-17 - Prevent Stored XSS in inline EJS scripts
**Vulnerability:** Inline variables written directly to scripts with `JSON.stringify` could leak unsanitized content, opening an XSS window if an unescaped `</script>` tag (or similar exploit payload) were to exist in the underlying data object.
**Learning:** In inline templates (specifically `<%- JSON.stringify() %>`), the framework output bypasses natural DOM-based protections, allowing user-manipulated JSON data to interfere with script execution boundaries if unescaped `<` characters exist.
**Prevention:** Always append `.replace(/</g, '\\u003c')` when serializing JSON data payloads inside `script` tags in EJS templates.
