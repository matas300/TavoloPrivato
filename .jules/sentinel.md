## 2026-04-08 - Fixed hardcoded session secret
**Vulnerability:** Hardcoded session secret (`tavolibero-secret-key-dev`) and insecure cookie configuration.
**Learning:** Found an express session using a hardcoded secret. This allows attackers to forge session cookies and gain unauthorized access to accounts. Additionally, cookies lacked `httpOnly` and `secure` flags, exposing them to XSS and man-in-the-middle attacks.

## 2026-05-23 - EJS JSON Injection Stored XSS
**Vulnerability:** Passing unfiltered data via JSON.stringify in EJS tags (<%- JSON.stringify(data) %>) allows for Stored XSS if the data contains <script> tags.
**Learning:** EJS \`<%-\` output bypasses HTML escaping. When passing JSON to the client-side \`<script>\`, backslashes or unicode sequences must be used for HTML-special characters.
**Prevention:** Use \`<%- (JSON.stringify(data) || 'null').replace(/</g, '\\u003c').replace(/>/g, '\\u003e') %>\` to ensure safe JSON hydration in templates.
