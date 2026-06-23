## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-04-10 - Fix DOM XSS via innerHTML injection
**Vulnerability:** DOM-based Cross-Site Scripting (XSS) due to unescaped user inputs injected directly into `.innerHTML` in `public/js/earnings-simulator-page.js`.
**Learning:** When client-side scripts build HTML strings and assign them to `.innerHTML`, any dynamic user data must be sanitized. Replacing `<`, `>`, `&`, `"`, and `'` with HTML entities is required to prevent script injection.
**Prevention:** Always implement and use an `escapeHtml` helper function for any user-controlled variable interpolated into HTML strings destined for `.innerHTML`, or use safer alternatives like `.textContent` where possible.
