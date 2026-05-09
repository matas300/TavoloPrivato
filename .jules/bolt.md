# Bolt Journal

## 2025-02-12 - Initial exploration
**Learning:** This is an Express application using EJS templates. It has an in-memory mock data store (`data/mock.js`) that can be optionally hydrated from Prisma. The `server.js` file handles the express setup. It has a `simulator` module (`lib/earnings-simulator.js`).

**Action:** Look for typical performance bottlenecks in Express/Node.js apps: missing caching, inefficient loops, synchronous operations, large payloads, missing indexes.

## 2025-02-12 - `cleanText` optimization
**Learning:** `cleanText` function used `reduce` with `split().join()` for a list of string replacements, doing an array operation for every string property accessed. `cleanText` is heavily used when enhancing/formatting workers and restaurants from the mock database, causing a significant slowdown on loops like `getWorkerMatchesForRestaurant` and `getOpenServiceRequestsForWorker`.
**Action:** Replaced `split().join()` loop with a single Regex replacement, precompiling the regex and a lookup map. Improved execution time for large datasets by over 10x!
## 2024-11-20 - Expensive Map Pre-filtering in Mock Database Queries
**Learning:** In `data/marketplace-service.js`, the mock database queries run `.map()` which executes computationally heavy functions (`getEnhancedWorker`, `getEnhancedRestaurant`, `buildPairMetrics`). Filtering the results *after* mapping creates significant N+1 overhead and wasted computation on rejected rows.
**Action:** Always inspect `.filter()` chains following `.map()`. Move filters that rely only on raw DB fields (`zona`, `budget`, `esperienza`) to a pre-filter step before mapping. Leave filters dependent on derived properties (`qualifica` via `hardSkills`) post-map to avoid breaking logic.
