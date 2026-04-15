## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.
**Prevention:** Always use environment variables for secrets (`process.env.SESSION_SECRET`). Fallback securely in production (e.g., using `crypto.randomBytes(32).toString('hex')` to generate a random secret if none is provided). Always set `httpOnly: true` and `secure: process.env.NODE_ENV === 'production'` on session cookies.
## 2026-04-15 - Fixed Math.random() usage for unique identifiers
**Vulnerability:** Use of predictable pseudo-random number generator (Math.random()) for security-related keys.
**Learning:** Found `Math.random()` used to generate `visitorKey`. This is predictable and can lead to identifier collisions or guessing.
**Prevention:** Always use cryptographically secure random number generation (like `crypto.randomBytes(16).toString('hex')`) for generating unique IDs, tokens, or keys.
