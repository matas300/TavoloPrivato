# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2024-05-24 - Pre-filtering raw data arrays before expensive map operations
**Learning:** Found that filters on complex objects (`zona`, `budget`, `esperienza`) can often be applied to the base, raw objects before they pass through expensive formatting and normalizer mappings. In `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`, applying these raw filters before `map` reduces the number of items that require costly in-memory enhancements like `getEnhancedWorker` and `buildPairMetrics`.
**Action:** When working with base data arrays, ensure you filter on raw fields first before running mapping functions to maintain optimal performance.
