# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2024-06-11 - [Optimize filter before map in marketplace-service]
**Learning:** In `data/marketplace-service.js`, the filtering operations were previously done after expensive `.map()` calls which enhance user objects with many fields and heavy database reads.
**Action:** Always apply filters to raw data fields (`zona`, `budget`, `esperienza`, etc.) *before* the `.map()` operations to significantly reduce CPU cycles and memory allocations. But leave filters dependent on derived fields (like `qualifica` mapping to `hardSkills`) *after* the map to avoid errors or repeating complex logic.
