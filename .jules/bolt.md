# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2023-10-25 - Safe Early Filtering
**Learning:** Applying filters to array items before mapping them to expensive structures avoids wasting operations. However, filtering must *only* apply to raw fields that are unaltered by the enhancement layer, and should avoid duplicating enhancement logic. Furthermore, when inverting comparisons to "filter out" invalid items (e.g. `! (value >= limit)` instead of `value < limit`), it is essential to write them carefully to correctly handle cases where the value might be `undefined` or `NaN`.
**Action:** When implementing early filtering, restrict the filters to raw primitive data and use `!(condition)` for drop logic to retain correct behavior on edge cases.
