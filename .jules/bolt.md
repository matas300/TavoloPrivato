# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2025-02-14 - Optimize Marketplace Filters
**Learning:** In `data/marketplace-service.js`, filtering raw database arrays (`db.getCamerieri()`, `db.annunci`) on raw fields BEFORE mapping them with expensive enhancement functions (`getEnhancedWorker`, `buildPairMetrics`) saves significant unnecessary processing. However, any filters that rely on fields enhanced *during* that map operation (e.g., `qualifica` relying on `hardSkills`) must remain AFTER the map.
**Action:** When filtering data, always separate filters into "pre-map" (raw fields) and "post-map" (enhanced fields). Use safe fallbacks (`|| 0`) and directly invoke normalizers (`cleanText`) in the pre-map filters to ensure the logic matches the post-map behavior exactly.
