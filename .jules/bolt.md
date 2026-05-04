# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2025-02-12 - Early Array Filtering Optimization
**Learning:** `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker` were processing (mapping with `getEnhancedWorker` and `buildPairMetrics`) every single record in the mock database before applying filters. With a high volume of records, this mapping is very expensive (e.g. allocating objects, iterating metrics).
**Action:** Filtered the base raw array on basic properties (`zona`, `budget`, `esperienza`) BEFORE the `.map()` step. This single change drastically reduced the overhead, speeding up execution significantly for typical filtered queries without breaking logic since `getEnhancedWorker` only copies those raw properties without mutating them.
