let PrismaClientCtor = null;

try {
  ({ PrismaClient: PrismaClientCtor } = require('@prisma/client'));
} catch (error) {
  PrismaClientCtor = null;
}

let prismaSingleton = null;

function getPrismaClient() {
  if (!PrismaClientCtor || !process.env.DATABASE_URL) {
    return null;
  }

  if (!prismaSingleton) {
    prismaSingleton = new PrismaClientCtor({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
  }

  return prismaSingleton;
}

function isPrismaReady() {
  return Boolean(PrismaClientCtor && process.env.DATABASE_URL);
}

module.exports = {
  getPrismaClient,
  isPrismaReady
};
