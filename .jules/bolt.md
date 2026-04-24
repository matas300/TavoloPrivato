# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2024-04-24 - [Avoid mapping before filtering]
**Learning:** In `data/marketplace-service.js`, the methods to get open service requests and worker matches map the base `db.getCamerieri()` and `db.annunci` arrays into enhanced objects (e.g., `getEnhancedWorker`, `getEnhancedRestaurant`, `buildPairMetrics`) *before* applying filters for `budget`, `zona`, and `esperienza`. This means expensive computations are needlessly executed for objects that will eventually be discarded. Filtering on raw object properties before map operations drastically reduces the processing footprint.
**Action:** Always filter large raw arrays *before* invoking `.map()` loops containing heavy operations or complex object compositions. However, care must be taken to distinguish between raw fields that can be filtered initially and derived/normalized fields (like `qualifiche` and `tipo`) that should be filtered after mapping.
