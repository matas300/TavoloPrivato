1. **Identify Performance Bottleneck**: The `getOpenServiceRequestsForWorker` and `getWorkerMatchesForRestaurant` functions in `data/marketplace-service.js` use an inefficient pattern by filtering after a heavy mapping operation (`.filter().map()` style, sometimes creating intermediate arrays or full arrays of objects). The optimization is to use `Array.prototype.reduce` to combine filtering and mapping in a single pass, and to apply cheap filters (like `stato === 'aperto'` or early bailouts based on `tipo`, `budget`, `zona`, `esperienza`, `qualifica`) *before* expensive normalizations like `getEnhancedRestaurant`, `buildPairMetrics`, `packageForRestaurantAndRequest`, etc.

2. **Refactor `getOpenServiceRequestsForWorker`**:
   - Replace the chained `filter().map()` and subsequent `filter()` on `items` with a single `reduce` loop.
   - Apply filter conditions (`tipo`, `budget`, `zona`) early inside the reduce loop to skip expensive computations for items that will be filtered out anyway.
   - Ensure to use the normalized values where necessary (e.g. `normalizedAnnuncio.tipo` or `normalizedAnnuncio.budget`). Note: `annuncio.budget` is equal to `normalizedAnnuncio.budget` in this system (or close enough), but doing `normalizeAnnuncio(annuncio)` early is relatively cheap compared to `getEnhancedRestaurant(annuncio.ristoranteId)` and `buildPairMetrics(workerId, annuncio.ristoranteId)`.

3. **Refactor `getWorkerMatchesForRestaurant`**:
   - Replace the `.map()` and subsequent `.filter()` loops with a single `reduce` loop.
   - Extract `getEnhancedWorker(worker.id)` at the top of the reduce block, then immediately apply filters (`zona`, `qualifica`, `esperienza`, `budget`) before calling `buildPairMetrics` or `scoreWorkerToRestaurant` which are much heavier.

4. **Add Bolt Journal Entry**: Add an entry to `.jules/bolt.md` reflecting on the optimization: avoiding heavy data normalization or complex metric computations on items that are going to be filtered out.

5. **Pre-commit and Submit**:
   - Run tests/verify performance locally (e.g. running the benchmark again to confirm ~6-7x speedup).
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
   - Use `submit` with a descriptive PR.
