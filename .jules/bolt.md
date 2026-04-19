# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2025-02-13 - Filtering base arrays before running expensive mappings
**Learning:** In `data/marketplace-service.js`, iterating and mapping over large datasets (like `db.getCamerieri()` and `db.annunci`) with expensive mock enhancements like `getEnhancedWorker` and `buildPairMetrics` causes severe performance degradation, especially when most items are later filtered out anyway.
**Action:** Always apply basic filters (`zona`, `budget`, `esperienza`) to the base arrays *before* applying the `.map()` with expensive enhancement calls. This dramatically reduced execution time for search functions.