## 2024-06-09 - Accessible Dynamic Notifications
**Learning:** Adding `aria-label` to containers with dynamic text (like notification badges) and using `aria-hidden="true"` on the visual elements prevents screen readers from redundantly announcing the content.
**Action:** When creating notification badges or dynamic icons, apply `aria-label` to the container using EJS interpolation and hide internal icons and badges with `aria-hidden="true"`.
