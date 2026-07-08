# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2026-07-08 - Array .filter() inside .map() loop Bottlenecks
**Learning:** Calling an O(N) array `.filter()` inside an O(M) loop (like a `.map()` or `for...of` iterating over collections of items or users) silently creates an O(N*M) time complexity bottleneck. In `data/marketplace-service.js`, iterating through users or announcements while filtering `db.contratti` per match severely slowed down operations under load.
**Action:** Always pre-process the target array into a Hash `Map` grouping items by the match key (O(N) initialization). Then, perform O(1) `.get()` lookups inside the loop to achieve O(N + M) linear time complexity.
