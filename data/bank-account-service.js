// CRUD BankAccount con invariante "un solo primary per owner" mantenuto via transaction.
// Ownership polimorfico: workerProfileId OR restaurantProfileId, mai entrambi.

const { getPrismaClient } = require('../lib/prisma');
const { isValidIban, normalizeIban } = require('../lib/iban');

function prismaOrThrow() {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error('prisma_unavailable');
  return prisma;
}

function validateInput(input) {
  const errors = [];
  const iban = normalizeIban(input.iban);
  if (!isValidIban(iban)) errors.push({ field: 'iban', message: 'IBAN non valido' });
  if (!input.holderName || input.holderName.length > 128) errors.push({ field: 'holderName', message: 'Nome intestatario richiesto (max 128 char)' });
  if (!/^[A-Z0-9]{16}$/.test((input.holderFiscalCode || '').toUpperCase())) errors.push({ field: 'holderFiscalCode', message: 'Codice fiscale non nel formato IT (16 char)' });
  if (input.label && input.label.length > 64) errors.push({ field: 'label', message: 'Etichetta max 64 char' });
  return { iban, errors };
}

function ownerFilter(ownerType, ownerId) {
  if (ownerType === 'worker') return { workerProfileId: ownerId };
  if (ownerType === 'restaurant') return { restaurantProfileId: ownerId };
  throw new Error(`ownerType non supportato: ${ownerType}`);
}

async function listForOwner(ownerType, ownerId) {
  const prisma = prismaOrThrow();
  return prisma.bankAccount.findMany({
    where: ownerFilter(ownerType, ownerId),
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
  });
}

async function createForOwner(ownerType, ownerId, input) {
  const prisma = prismaOrThrow();
  const { iban, errors } = validateInput(input);
  if (errors.length) return { ok: false, errors };

  const owner = ownerFilter(ownerType, ownerId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.bankAccount.findMany({ where: { ...owner, status: 'active' } });
    const isFirst = existing.length === 0;
    const created = await tx.bankAccount.create({
      data: {
        ownerType,
        ...owner,
        iban,
        bic: input.bic || null,
        holderName: input.holderName,
        holderFiscalCode: input.holderFiscalCode.toUpperCase(),
        label: input.label || null,
        isPrimary: isFirst,
        status: 'active'
      }
    });
    return { ok: true, bankAccount: created };
  });
}

async function setPrimary(ownerType, ownerId, bankAccountId) {
  const prisma = prismaOrThrow();
  const owner = ownerFilter(ownerType, ownerId);
  return prisma.$transaction(async (tx) => {
    const target = await tx.bankAccount.findFirst({ where: { id: bankAccountId, ...owner } });
    if (!target) return { ok: false, error: 'not_found' };
    if (target.status !== 'active') return { ok: false, error: 'archived_cannot_be_primary' };
    await tx.bankAccount.updateMany({ where: { ...owner, isPrimary: true }, data: { isPrimary: false } });
    await tx.bankAccount.update({ where: { id: bankAccountId }, data: { isPrimary: true } });
    return { ok: true };
  });
}

async function archive(ownerType, ownerId, bankAccountId) {
  const prisma = prismaOrThrow();
  const owner = ownerFilter(ownerType, ownerId);
  const target = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, ...owner } });
  if (!target) return { ok: false, error: 'not_found' };
  if (target.isPrimary) return { ok: false, error: 'primary_cannot_archive' };
  await prisma.bankAccount.update({ where: { id: bankAccountId }, data: { status: 'archived', isPrimary: false } });
  return { ok: true };
}

async function getPrimary(ownerType, ownerId) {
  const prisma = prismaOrThrow();
  return prisma.bankAccount.findFirst({ where: { ...ownerFilter(ownerType, ownerId), isPrimary: true, status: 'active' } });
}

module.exports = { listForOwner, createForOwner, setPrimary, archive, getPrimary, validateInput };
