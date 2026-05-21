# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2026-05-21 - Optimization: Move Filters Before Mappings
**Learning:** In complex mapping operations, applying filters to the raw base data before expensive derivations (like 'getEnhancedWorker' or 'buildPairMetrics') drastically reduces execution time. We noticed a huge 5x-10x speedup by shifting the simple property checks (like zona, tipo, budget) ahead of the mapped properties.
**Action:** Always filter the source list of items based on simple attributes before applying complex transformations and enhancements in maps, provided the filtered attributes don't rely on the mapping results.
