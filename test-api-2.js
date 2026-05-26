const marketplaceService = require('./data/marketplace-service');

const res1 = marketplaceService.getOpenServiceRequestsForWorker(1, { zona: 'Roma Centro', tipo: 'cena', budget: 100 });
console.log(res1);

const res2 = marketplaceService.getWorkerMatchesForRestaurant(10, { zona: 'Roma Centro', esperienza: 2, budget: 100 });
console.log(res2);
