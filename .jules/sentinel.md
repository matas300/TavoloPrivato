## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2025-02-18 - Fix XSS in EJS JSON.stringify
**Vulnerability:** EJS templates outputting `JSON.stringify` into client-side JS variables using unescaped `<%- ... %>` tags allow stored XSS (e.g. `</script><script>alert(1)</script>`).
**Learning:** Using single backslash `\u003c` string replacement inside JavaScript string context evaluates to `<` before rendering, failing to prevent XSS.
**Prevention:** Use double backslash (`\\u003c`) so the output string literal natively includes the backslash, preventing the JS interpreter from seeing a raw `<`.
