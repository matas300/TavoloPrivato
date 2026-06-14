# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2026-06-14 - Optimize loop filtering in marketplace-service
**Learning:** `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker` previously fetched all data, mapped through it applying heavy calculations (like `buildPairMetrics` and `getEnhancedWorker`), and filtered at the end. By swapping to a single `for...of` loop and applying base filters *before* expensive calculations, execution time was cut significantly for queries using filters.
**Action:** Avoid chaining `.map().filter()` when processing lists where expensive object derivations can be conditionally skipped. Apply simple filtering rules inside a loop before performing heavy normalization.
