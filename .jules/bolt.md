# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2024-05-18 - Avoid redundant data normalization and mapping in data processing pipelines
**Learning:** Chaining `.map()` and `.filter()` operations can lead to significant performance overhead when dealing with object normalization or enhancement, especially if items that are eventually filtered out undergo expensive transformations first. This was evident in `marketplace-service.js` where `buildPairMetrics` and `getEnhancedWorker` were called on all entries before filtering.
**Action:** Use a single loop (like `for...of` or `.reduce()`) to apply fast base filters first. Only compute expensive operations, like full profile enhancement or pair metrics, on the subset of data that passes the fast filters.
