# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!

## 2025-02-12 - N+1 Array Filtering Optimization in buildPairMetrics
**Learning:** Inside `buildPairMetrics`, filtering the entire `db.contratti` array per match call leads to an O(N²) nested loop complexity when called in loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`. Array `.filter()` in a map loop is extremely slow with large mock datasets.
**Action:** Pre-group the needed objects into hash-maps (`contractsByWorker` / `contractsByRestaurant`) before entering the `map` loops, turning O(N²) iterations into an O(N) pre-processing step followed by O(1) lookups. Passed these as optional parameters to maintain backwards compatibility while optimizing performance.
