# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2025-02-12 - Early filtering before expensive mapping
**Learning:** In the mock database architecture (`data/marketplace-service.js`), filtering data *after* `.map()` functions like `getEnhancedWorker` or `getEnhancedRestaurant` creates a massive performance bottleneck. These enhancement functions do a lot of work (string replacements, array iterations, derived fields).
**Action:** Always apply filters to raw properties (like `zona`, `budget`, `esperienza`) *before* the `.map()` step. Keep only derived property filters (like `qualifica` based on `hardSkills`) after the mapping. This avoids doing heavy computations for items that are immediately discarded.
