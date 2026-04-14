## 2026-04-14 - Expensive Enhance Before Filter
**Learning:** In the mock DB-backed functions (`getWorkerMatchesForRestaurant`, `getOpenServiceRequestsForWorker`), data was originally being mapped and run through expensive functions like `getEnhancedWorker` and `buildPairMetrics` *before* simple filtering rules were applied.
**Action:** Always filter base records on simple conditions (`zona`, `esperienza`, `budget`, `tipo`) prior to iterating/mapping over them when creating rich "enhanced" DTOs.
