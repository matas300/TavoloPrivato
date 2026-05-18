# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2024-05-18 - Avoid array iteration overhead in heavy map routines
**Learning:** In `marketplace-service.js`, operations mapping through raw base entities using computationally expensive hydration helpers (`getEnhancedWorker`, `getEnhancedRestaurant`, `buildPairMetrics`) had filters applied *after* hydration. Applying fast, raw-field filters before the map phase avoids hundreds of unnecessary hydration calls and speeds up list generation significantly.
**Action:** When filtering collections of elements that require complex derived state, always identify and apply conditions on raw or base fields before initiating mapping sequences. Only leave condition checks reliant on derived state *after* the mapping sequence.
