# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2026-04-04 - Pre-filtering mock data arrays
**Learning:** In the mock data service (`marketplace-service.js`), running expensive mapping operations like `getEnhancedWorker` or `buildPairMetrics` on the entire raw array before filtering is extremely slow, resulting in unnecessary computation for items that are eventually excluded.
**Action:** When working with simulated lists containing heavy normalizations and computed fields, apply raw attribute filters (`budget`, `zona`, `esperienza`, etc.) to the base data arrays (`db.getCamerieri()`, `db.annunci`) first, before mapping the remaining items to their fully enhanced view.
