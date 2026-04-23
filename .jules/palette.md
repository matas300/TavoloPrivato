## 2024-04-23 - Missing ARIA Labels on Icon-only Elements
**Learning:** Found a pattern of missing ARIA labels on icon-only interactive elements (like the sidebar toggle, notification bell, and chat send buttons). Because the app's interface is in Italian, these missing ARIA labels create significant accessibility barriers.
**Action:** When working on UI components in this app, always ensure that icon-only interactive elements have an `aria-label` attribute, and critically, that the label text is localized in Italian to match the app's primary language.
