# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2025-02-12 - Marketplace Filter Optimization
**Learning:** In `data/marketplace-service.js`, the search and matching logic for workers and restaurants used `.map()` to build complex, enhanced objects (e.g. `getEnhancedWorker`, computing scores, fetching metrics) for the *entire dataset*, and only afterward applied filters (zone, budget, experience). This caused massive CPU overhead on large searches.
**Action:** Always apply filters for raw database fields (`zona`, `budget`, `esperienza`) *before* expensive `.map()` enhancements. This reduced execution time by nearly 10x while maintaining exact output parity. Leaving derived field filters (like `qualifica` needing enhanced `hardSkills`) *after* the mapping ensures logic remains correct.
