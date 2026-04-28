## 2024-05-18 - Missing ARIA labels on Icon-only buttons
**Learning:** Found several icon-only buttons (`data-lucide` icons) that lack screen reader context, making the interface hard to navigate for visually impaired users. Italian localization must be kept in mind for accessibility labels.
**Action:** When adding or auditing icon-only buttons, always enforce the inclusion of localized `aria-label`s.
