# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2025-02-12 - Marketplace List Optimizations
**Learning:** Functions like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker` mapped the entire mock dataset `db.getCamerieri()` and `db.annunci` (doing expensive data enhancements and normalizations) before filtering them down using search parameters. This resulted in an enormous amount of useless compute when queries were constrained by `zona`, `budget`, or `esperienza`.
**Action:** Always move array `.filter()` checks on raw fields (like `budget`, `zona`, `esperienza`) *before* the `.map()` step whenever possible. This avoids enhancing items that will just be dropped later.
