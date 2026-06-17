1. **Analyze UX Opportunities**:
    - Focus on accessibility and UX improvements for icon-only buttons.
    - We saw `<button class="menu-toggle">` in `views/partials/topbar.ejs` has no `aria-label`.
    - We saw the theme toggle in `views/partials/pub-nav.ejs` *has* `aria-label="Tema"` but the one in `views/partials/sidebar.ejs` does not. However, the sidebar one does have a `<span class="theme-label-light">` visible for screen readers, so it's less critical.
    - The notifications link `<a href="..." class="btn-icon">` in `views/partials/topbar.ejs` has no `aria-label`.
    - The send message button `<button type="submit" class="btn btn-primary"><i data-lucide="send"></i></button>` in `views/pages/cameriere/messaggi.ejs` and `views/pages/ristorante/messaggi.ejs` are missing `aria-label`s.
2. **Select the BEST opportunity**:
    - The missing `aria-label`s on core navigation and actions like `topbar.ejs` and messaging are perfect small wins.
    - I'll add `aria-label="Apri menu laterale"` to the menu toggle, and `aria-label="Notifiche"` to the notification link in the `topbar`.
    - I'll add `aria-label="Invia messaggio"` to the chat submit button in both message files.
3. **Plan Fixes**:
    - Update `views/partials/topbar.ejs`.
    - Update `views/pages/cameriere/messaggi.ejs`.
    - Update `views/pages/ristorante/messaggi.ejs`.
4. **Implement Details**:
    - I will use Python code to securely and correctly update the files.
5. **Verify**:
    - I will write a Python playwright script to start the dev server, log in as a cameriere, and assert that the attributes have been added and are accessible.
    - Clean up server log and test scripts.
6. **Pre-commit and PR**:
    - Follow instructions for the pre commit steps.
    - Create a pull request using the `submit` tool.
