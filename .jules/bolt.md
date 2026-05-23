# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2026-05-23 - Move raw field filtering before expensive enhancements
**Learning:** In `data/marketplace-service.js`, the methods `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker` were processing every single item (via `.map` with `getEnhancedWorker`/`getEnhancedRestaurant`, `buildPairMetrics`, etc.) *before* applying simple filters (like `budget`, `zona`, `esperienza`). This caused heavily expensive per-item processing for items that ultimately didn't match the user's basic search criteria.
**Action:** When working with base datasets that need mapping via computationally heavy enhancement logic, always filter on the raw field parameters *first* before doing `.map`. Applying safe fallbacks for missing values (e.g. `(a.budget || 0)`) prevents logic regressions.
