# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2026-04-08 - Optimize map/filter chains in marketplace service
**Learning:** Calling heavy enhancement functions like `getEnhancedWorker` and `buildPairMetrics` inside a `.map()` prior to basic filtering causes unnecessary performance overhead, as many generated objects are immediately discarded.
**Action:** When filtering data, apply normal filters directly on raw fields *before* running expensive mapping functions. Always ensure safe fallbacks for missing fields, and when relying on derived fields, keep those specific filters after the map to avoid duplicating complex enhancement logic.
