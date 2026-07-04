# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2024-05-20 - O(N²) array filtering bottlenecks in mock data
**Learning:** In the mock data service (`data/marketplace-service.js`), using `.filter()` on the entire `db.contratti` array from within `.map()` iterations (e.g., when iterating over users or requests) creates severe O(N²) performance bottlenecks. This becomes increasingly slow as the mock data size grows, causing an 8x performance penalty for a dataset of 500 workers and 5000 contracts.

**Action:** Pre-group the array data into hash maps (O(N) pre-processing time) before the mapping loop to allow O(1) lookups during the iteration, significantly optimizing performance.
