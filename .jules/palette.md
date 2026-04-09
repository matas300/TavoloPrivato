## 2025-02-27 - Icon-only buttons lack ARIA labels
**Learning:** Found multiple instances where icon-only buttons (like menu toggle, notification bell, chat send) lacked an `aria-label`, making them inaccessible to screen reader users as they have no visible text describing their action.
**Action:** When adding or reviewing interactive elements that contain only an icon (e.g., using `lucide` icons), always ensure an `aria-label` is provided describing the action the button performs.
