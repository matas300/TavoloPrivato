# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2024-06-11 - Optimized list generation with single loop
**Learning:** Chaining `.filter().map()` causes full arrays to be generated, and does unnecessary computations (e.g. `getEnhancedRestaurant`, `buildPairMetrics`) on elements that are eventually filtered out anyway.
**Action:** When filtering array structures based on computed properties, use a `for...of` loop with early `continue` statements instead of `.map().filter()` chains. Doing the cheap checks (like filtering before running the expensive `.getEnhancedRestaurant` and `scoreWorkerToRequest`) speeds up execution significantly.
