const { performance } = require('perf_hooks');
const db = require('./data/mock');
const ms = require('./data/marketplace-service');

// Duplicate users
const numUsers = 500;
for (let i = 0; i < numUsers; i++) {
  db.users.push({...db.users[0], id: 1000 + i, role: i % 2 === 0 ? 'cameriere' : 'ristorante'});
}

// Create a lot of contracts and annunci
for(let i=0; i<5000; i++) {
  db.contratti.push({...db.contratti[0], id: 10000+i, cameriereId: 1000 + (i % 250)*2, ristoranteId: 1001 + (i % 250)*2});
  db.annunci.push({...db.annunci[0], id: 10000+i, ristoranteId: 1001 + (i % 250)*2, stato: 'aperto'});
}

const start1 = performance.now();
for(let i=0; i<10; i++) {
  ms.getOpenServiceRequestsForWorker(1000);
}
const end1 = performance.now();
console.log(`Original getOpenServiceRequestsForWorker: ${end1 - start1} ms`);

const start2 = performance.now();
for(let i=0; i<10; i++) {
  ms.getWorkerMatchesForRestaurant(1001);
}
const end2 = performance.now();
console.log(`Original getWorkerMatchesForRestaurant: ${end2 - start2} ms`);
