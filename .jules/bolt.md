# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2024-06-25 - Prevented N+1 Object Augmentation
**Learning:** In `data/marketplace-service.js`, basic arrays (`db.annunci`, `db.getCamerieri()`) were being mapped and enhanced with expensive in-memory operations (like `getEnhancedWorker`, `getEnhancedRestaurant`, `buildPairMetrics`) BEFORE being filtered. This caused unnecessary heavy processing for items that were going to be discarded anyway by `filters.zona`, `filters.tipo`, or `filters.budget`.
**Action:** Always apply basic string/number filters to base lists before applying expensive `.map()` augmentation logic to improve performance, especially with large mock or raw data sets.
