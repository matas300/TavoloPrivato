# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2026-04-10 - Memoizing derived profiles in N+1 loops
**Learning:** `marketplace-service.js` frequently loops over large lists (like `annunci` or `contratti`), and inside these O(N) loops, it frequently calls profile enhancer functions like `getEnhancedRestaurant(id)` and `buildPairMetrics(workerId, restaurantId)`. Even if the underlying base lookup is fast, building these derived profiles involves parsing, array map/filters, and calculating metrics which adds up significantly.
**Action:** When writing mapping/filtering loops over multiple items that share common foreign keys (like multiple service requests from the same restaurant), use a local `const cache = {}` at the top of the function to memoize the enhanced lookups by ID. It is much safer than global caching since it guarantees freshness and requires zero cache-invalidation logic while dramatically improving response times for single requests.
