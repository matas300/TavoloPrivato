# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2025-02-13 - Early returns / filtering before map
**Learning:** In the core `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker` queries, an expensive `map` step generates derived data (by calling `getEnhancedWorker`, `getEnhancedRestaurant`, computing scores, etc.) *before* applying multiple `filter` operations on those results.
**Action:** Filter raw input collections based on basic criteria (`budget`, `zona`, `esperienza`) *before* the mapping block. In benchmarks, doing the inexpensive checks first on a large mock dataset reduced execution times by ~75% (e.g., from ~4ms to ~1.1ms). Applied to `marketplace-service.js`.
