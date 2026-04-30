## 2023-10-27 - [EJS JSON Stringify XSS]
**Vulnerability:** XSS via `<%- JSON.stringify(...) %>` inside `<script>` blocks in EJS templates.
**Learning:** Data serialized directly into `<script>` tags without escaping HTML entities allows attackers to break out of the string literal and inject arbitrary JavaScript via properties ending in `</script>`.
**Prevention:** Always escape HTML entities by appending `.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')` to the stringified output when rendering EJS objects into JavaScript contexts.
