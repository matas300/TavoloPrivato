# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2025-02-12 - Early Filtering in Mock Arrays
**Learning:** In the mock data system, filtering raw db arrays (like `db.annunci` or `db.getCamerieri()`) *before* applying expensive enhancement `.map()` functions significantly improves performance. However, care must be taken to only filter on raw fields that do not depend on normalization logic (e.g. `budget`, `zona`, `esperienza`), while deferring filters dependent on enhanced fields (e.g. `qualifiche`, `tipo`). Additionally, fetching related info via `db.getUser()` directly is safer than relying on undefined helper functions like `getRestaurantBase()` within inline array functions.
**Action:** Always pre-filter mock data sets using simple `.filter()` predicates on raw fields before calling `getEnhancedWorker` or similar mapping functions.
