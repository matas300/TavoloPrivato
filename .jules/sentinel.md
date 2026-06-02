## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2024-05-24 - Prevent Stored XSS in EJS templates
**Vulnerability:** EJS templates directly inject serialized objects into script blocks via `<%- JSON.stringify(...) %>`, which fails to escape HTML tags and leads to Stored XSS.
**Learning:** When template engines output raw JSON into a script tag context, a browser can incorrectly interpret payload strings like `</script><script>alert(1)</script>` as HTML closures.
**Prevention:** Always escape `<` and `>` characters by using `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')` after serializing the object, and fallback to `'null'` for empty states.
