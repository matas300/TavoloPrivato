# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2024-05-18 - [Optimize array filtering before expensive mappings]
**Learning:** In data processing pipelines involving complex enhancements (e.g., `getEnhancedWorker`, `buildPairMetrics`), filtering on raw fields after the `.map()` operation results in N unneeded expensive computations. Moving these simple checks before the map dramatically reduces execution time (from ~140ms to ~6ms in tests).
**Action:** Always filter on base data attributes before applying expensive map transformations, while being careful to leave filters that depend on derived properties (like enhanced skills) after the map.
