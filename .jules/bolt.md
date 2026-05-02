# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2025-02-27 - Pre-filtering base arrays before expensive mappings
**Learning:** In `data/marketplace-service.js`, the app was mapping entire base database arrays (e.g., `db.getCamerieri()`) via expensive enhancement functions like `getEnhancedWorker` and `buildPairMetrics` before filtering the results. This is extremely inefficient since it performs heavy object enhancements and calculations for records that will be discarded.
**Action:** Always apply filters that depend only on raw database fields *before* running map operations that enrich the data or perform heavy computation. Leave filters that depend on enriched properties (like `hardSkills`) for after the map.
