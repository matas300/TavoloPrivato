## 2026-05-07 - Accessible Icon Buttons
**Learning:** Found several icon-only buttons missing `aria-label` and using `data-lucide` icons without `aria-hidden="true"`. This causes screen readers to either announce nothing or announce irrelevant icon markup, leading to poor keyboard/screen reader navigation.
**Action:** When implementing icon-only buttons or links, always add an `aria-label` to the button/link and `aria-hidden="true"` to the internal icon element.
