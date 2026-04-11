const seed = require('./mock-seed');
const { getPrismaClient, isPrismaReady } = require('../lib/prisma');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function replaceArray(target, nextItems) {
  target.splice(0, target.length, ...nextItems);
}

function replaceObject(target, nextObject) {
  Object.keys(target).forEach(key => delete target[key]);
  Object.assign(target, nextObject);
}

function formatDateOnly(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 16).replace('T', ' ');
}

function parseJsonArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [];
}

function mapRequestStatus(value) {
  if (value === 'open') return 'aperto';
  if (value === 'cancelled') return 'chiuso';
  if (value === 'completed') return 'completato';
  return 'aperto';
}

function mapContractStatus(value, fallback) {
  if (fallback) return fallback;
  if (value === 'awaiting_signature' || value === 'signed') return 'confermato';
  if (value === 'completed') return 'completato';
  return 'bozza';
}

const users = [];
const annunci = [];
const contratti = [];
const messaggi = [];
const alerts = [];
const auditLog = [];
const nonRenewal = [];
const commissioni = {};

const storageInfo = {
  runtime: 'mock',
  prismaConfigured: isPrismaReady(),
  prismaProvider: (process.env.DATABASE_URL || '').startsWith('file:')
    ? 'sqlite'
    : (process.env.DATABASE_URL || '').startsWith('postgres')
      ? 'postgresql'
      : null,
  seedSource: 'data/mock-seed.js',
  hydratedAt: null,
  lastError: null
};

function resetFromSeed() {
  replaceArray(users, clone(seed.users));
  replaceArray(annunci, clone(seed.annunci));
  replaceArray(contratti, clone(seed.contratti));
  replaceArray(messaggi, clone(seed.messaggi));
  replaceArray(alerts, clone(seed.alerts));
  replaceArray(auditLog, clone(seed.auditLog));
  replaceArray(nonRenewal, clone(seed.nonRenewal));
  replaceObject(commissioni, clone(seed.commissioni));
  storageInfo.runtime = 'mock';
  storageInfo.hydratedAt = null;
  storageInfo.lastError = null;
}

function getSeedUserMap() {
  return new Map(seed.users.map(item => [item.id, item]));
}

function getSeedRequestMap() {
  return new Map(seed.annunci.map(item => [item.id, item]));
}

function getSeedContractMap() {
  return new Map(seed.contratti.map(item => [item.id, item]));
}

function getSeedMessageMap() {
  return new Map(seed.messaggi.map(item => [item.id, item]));
}

function getSeedAuditMap() {
  return new Map(seed.auditLog.map((item, index) => [index + 1, item]));
}

function getSeedNonRenewalMap() {
  return new Map(seed.nonRenewal.map((item, index) => [index + 1, item]));
}

function mapUserFromPrisma(row, seedUserMap) {
  const base = clone(seedUserMap.get(row.id) || {});
  const venue = row.restaurantProfile?.venues?.[0];
  const review = row.reviewAggregate;
  const workerTax = row.workerProfile?.taxProfile;

  return {
    ...base,
    id: row.id,
    email: row.email,
    password: row.passwordHash || base.password || 'demo',
    role: row.role,
    status: row.status,
    name: row.displayName,
    initials: row.initials || base.initials || (row.displayName || '').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(),
    bio: row.workerProfile?.bio ?? base.bio,
    esperienza: row.workerProfile?.yearsExperience ?? base.esperienza,
    disponibilita: row.workerProfile?.availabilityJson ?? base.disponibilita,
    zona: row.workerProfile?.homeCity
      ?? venue?.city
      ?? row.restaurantProfile?.organization?.city
      ?? base.zona,
    rating: review?.overallAvg
      ?? row.workerProfile?.ratingAvg
      ?? row.restaurantProfile?.ratingAvg
      ?? base.rating,
    ratingCount: review?.reviewCount
      ?? row.workerProfile?.ratingCount
      ?? row.restaurantProfile?.ratingCount
      ?? base.ratingCount,
    verificato: row.isVerified ?? base.verificato ?? false,
    pagaMin: row.workerProfile?.minimumFeeEur ?? base.pagaMin,
    ytdEarnings: workerTax?.platformGrossYtdEur ?? base.ytdEarnings,
    walletBalance: base.walletBalance,
    pivaLast4: row.workerProfile?.vatNumber
      ? String(row.workerProfile.vatNumber).slice(-4)
      : base.pivaLast4,
    indirizzo: venue?.addressLine ?? base.indirizzo,
    tipoCucina: row.restaurantProfile?.cuisineType ?? base.tipoCucina,
    capienza: venue?.indoorCapacity ?? base.capienza
  };
}

function mapRequestFromPrisma(row, seedRequestMap) {
  const base = clone(seedRequestMap.get(row.id) || {});
  return {
    ...base,
    id: row.id,
    ristoranteId: row.restaurantProfileId,
    data: formatDateOnly(row.requestedDate),
    tipo: row.servicePackage?.serviceType || base.tipo || 'cena',
    qualifiche: parseJsonArray(row.requestedSkills).length ? parseJsonArray(row.requestedSkills) : (base.qualifiche || []),
    budget: row.servicePackage?.flatFeeEur ?? base.budget ?? 0,
    desc: row.notes ?? base.desc ?? '',
    stato: mapRequestStatus(row.status)
  };
}

function mapContractFromPrisma(row, seedContractMap) {
  const base = clone(seedContractMap.get(row.id) || {});
  const workerReview = row.reviews?.find(review => review.reviewerUserId === row.workerProfileId) || null;
  const restaurantReview = row.reviews?.find(review => review.reviewerUserId === row.restaurantProfileId) || null;
  return {
    ...base,
    id: row.id,
    cameriereId: row.workerProfileId,
    ristoranteId: row.restaurantProfileId,
    data: formatDateOnly(row.serviceDate),
    tipo: row.serviceType || base.tipo || 'cena',
    compensoCam: row.workerNetEur,
    commissione: row.platformFeeEur,
    stato: mapContractStatus(row.status, base.stato),
    valCam: workerReview?.professionalism ?? base.valCam ?? null,
    valRist: restaurantReview?.professionalism ?? base.valRist ?? null,
    commentoRist: restaurantReview?.commentText ?? base.commentoRist ?? null
  };
}

function mapMessageFromPrisma(row, seedMessageMap) {
  const base = clone(seedMessageMap.get(row.id) || {});
  const workerId = row.chatThread.workerProfileId;
  const restaurantId = row.chatThread.restaurantProfileId;
  const to = row.senderUserId === workerId ? restaurantId : workerId;

  return {
    ...base,
    id: row.id,
    from: row.senderUserId,
    to,
    text: row.messageBody,
    time: formatDateTime(row.sentAt),
    read: Boolean(row.readAt)
  };
}

function mapAuditFromPrisma(row, seedAuditMap) {
  const base = clone(seedAuditMap.get(row.id) || {});
  return {
    ...base,
    time: formatDateTime(row.createdAt),
    user: row.actorEmail || base.user || 'sistema',
    action: row.contextPayload?.action || base.action || row.actionKey,
    tipo: row.actionKey || base.tipo || 'sistema'
  };
}

function mapNonRenewalFromPrisma(row, seedNonRenewalMap) {
  const base = clone(seedNonRenewalMap.get(row.id) || {});
  return {
    ...base,
    ristoranteId: row.restaurantProfileId,
    cameriereId: row.workerProfileId,
    motivo: row.reason,
    data: formatDateOnly(row.effectiveDate)
  };
}

async function hydrateFromPrisma() {
  const prisma = getPrismaClient();
  if (!prisma) {
    return storageInfo;
  }

  const seedUserMap = getSeedUserMap();
  const seedRequestMap = getSeedRequestMap();
  const seedContractMap = getSeedContractMap();
  const seedMessageMap = getSeedMessageMap();
  const seedAuditMap = getSeedAuditMap();
  const seedNonRenewalMap = getSeedNonRenewalMap();

  const [
    prismaUsers,
    prismaRequests,
    prismaContracts,
    prismaMessages,
    prismaAlerts,
    prismaAudit,
    prismaNonRenewal,
    commissioniSetting
  ] = await Promise.all([
    prisma.user.findMany({
      include: {
        workerProfile: {
          include: {
            taxProfile: true
          }
        },
        restaurantProfile: {
          include: {
            organization: true,
            venues: true
          }
        },
        reviewAggregate: true
      },
      orderBy: { id: 'asc' }
    }),
    prisma.serviceRequest.findMany({
      include: {
        servicePackage: true
      },
      orderBy: { id: 'asc' }
    }),
    prisma.serviceContract.findMany({
      include: {
        reviews: true
      },
      orderBy: { id: 'asc' }
    }),
    prisma.message.findMany({
      include: {
        chatThread: true
      },
      orderBy: { id: 'asc' }
    }),
    prisma.complianceAlert.findMany({
      orderBy: { id: 'asc' }
    }),
    prisma.auditLog.findMany({
      orderBy: { id: 'asc' }
    }),
    prisma.nonRenewal.findMany({
      orderBy: { id: 'asc' }
    }),
    prisma.platformSetting.findUnique({
      where: {
        settingKey: 'commissioni'
      }
    })
  ]);

  replaceArray(users, prismaUsers.map(row => mapUserFromPrisma(row, seedUserMap)));
  replaceArray(annunci, prismaRequests.map(row => mapRequestFromPrisma(row, seedRequestMap)));
  replaceArray(contratti, prismaContracts.map(row => mapContractFromPrisma(row, seedContractMap)));
  replaceArray(messaggi, prismaMessages.map(row => mapMessageFromPrisma(row, seedMessageMap)));
  replaceArray(alerts, prismaAlerts.length ? prismaAlerts.map((row, index) => ({
    id: row.id || index + 1,
    tipo: row.alertType,
    desc: row.alertMessage,
    severity: row.severity,
    data: formatDateOnly(row.createdAt),
    stato: row.status
  })) : clone(seed.alerts));
  replaceArray(auditLog, prismaAudit.map(row => mapAuditFromPrisma(row, seedAuditMap)));
  replaceArray(nonRenewal, prismaNonRenewal.map(row => mapNonRenewalFromPrisma(row, seedNonRenewalMap)));
  replaceObject(commissioni, clone(commissioniSetting?.valueJson || seed.commissioni));

  storageInfo.runtime = 'prisma';
  storageInfo.hydratedAt = new Date().toISOString();
  storageInfo.lastError = null;
  return storageInfo;
}

function getUser(id) {
  return users.find(u => u.id === id);
}

function getUserByEmail(email) {
  return users.find(u => u.email === email);
}

function getCamerieri() {
  return users.filter(u => u.role === 'cameriere');
}

function getRistoranti() {
  return users.filter(u => u.role === 'ristorante');
}

function getContrattiForUser(userId, role) {
  if (role === 'cameriere') return contratti.filter(c => c.cameriereId === userId);
  if (role === 'ristorante') return contratti.filter(c => c.ristoranteId === userId);
  return contratti;
}

function getMessaggiForUser(userId) {
  return messaggi.filter(m => m.from === userId || m.to === userId);
}

function getConversationPartners(userId) {
  const msgs = getMessaggiForUser(userId);
  const partnerMap = new Map();

  for (const m of msgs) {
    const pid = m.from === userId ? m.to : m.from;
    if (!partnerMap.has(pid)) {
      partnerMap.set(pid, { lastMsg: null, unread: 0 });
    }
    const pd = partnerMap.get(pid);
    pd.lastMsg = m;
    if (m.to === userId && !m.read) {
      pd.unread++;
    }
  }

  const partners = [];
  for (const [pid, pd] of partnerMap.entries()) {
    const partner = getUser(pid);
    if (partner) {
      partners.push({ ...partner, lastMessage: pd.lastMsg, unreadCount: pd.unread });
    }
  }
  return partners;
}

function getConversation(userId, partnerId) {
  return messaggi.filter(m =>
    (m.from === userId && m.to === partnerId) || (m.from === partnerId && m.to === userId)
  );
}

function getPairIds(userId, partnerId) {
  const user = getUser(userId);
  const partner = getUser(partnerId);
  if (!user || !partner) {
    return { workerId: null, restaurantId: null };
  }

  return {
    workerId: user.role === 'cameriere' ? user.id : partner.id,
    restaurantId: user.role === 'ristorante' ? user.id : partner.id
  };
}

async function addMessage(from, to, text) {
  const nextId = messaggi.length ? Math.max(...messaggi.map(m => m.id)) + 1 : 1;
  const msg = {
    id: nextId,
    from,
    to,
    text,
    time: new Date().toISOString().slice(0, 16).replace('T', ' '),
    read: false
  };
  messaggi.push(msg);

  const prisma = getPrismaClient();
  if (!prisma) return msg;

  const { workerId, restaurantId } = getPairIds(from, to);
  if (!workerId || !restaurantId) return msg;

  try {
    let thread = await prisma.chatThread.findFirst({
      where: {
        workerProfileId: workerId,
        restaurantProfileId: restaurantId
      }
    });

    if (!thread) {
      thread = await prisma.chatThread.create({
        data: {
          workerProfileId: workerId,
          restaurantProfileId: restaurantId
        }
      });
    }

    await prisma.message.create({
      data: {
        id: msg.id,
        chatThreadId: thread.id,
        senderUserId: msg.from,
        messageBody: msg.text,
        sentAt: new Date(msg.time.replace(' ', 'T') + ':00'),
        readAt: null
      }
    });
  } catch (error) {
    storageInfo.lastError = error.message;
  }

  return msg;
}

async function markConversationRead(userId, partnerId) {
  const unreadMessages = messaggi.filter(m => m.from === partnerId && m.to === userId && !m.read);
  unreadMessages.forEach(message => {
    message.read = true;
  });

  const prisma = getPrismaClient();
  if (!prisma || !unreadMessages.length) {
    return unreadMessages.length;
  }

  const { workerId, restaurantId } = getPairIds(userId, partnerId);
  if (!workerId || !restaurantId) {
    return unreadMessages.length;
  }

  try {
    const thread = await prisma.chatThread.findFirst({
      where: {
        workerProfileId: workerId,
        restaurantProfileId: restaurantId
      }
    });

    if (thread) {
      await prisma.message.updateMany({
        where: {
          chatThreadId: thread.id,
          senderUserId: partnerId,
          readAt: null
        },
        data: {
          readAt: new Date()
        }
      });
    }
  } catch (error) {
    storageInfo.lastError = error.message;
  }

  return unreadMessages.length;
}

function getAnnunciByRistorante(ristoranteId) {
  return annunci.filter(a => a.ristoranteId === ristoranteId);
}

async function addAnnuncio(data) {
  const nextId = annunci.length ? Math.max(...annunci.map(a => a.id)) + 1 : 1;
  const ann = { id: nextId, ...data, stato: 'aperto' };
  annunci.push(ann);

  const prisma = getPrismaClient();
  if (!prisma) return ann;

  try {
    const servicePackage = await prisma.servicePackage.findFirst({
      where: {
        restaurantProfileId: ann.ristoranteId,
        serviceType: ann.tipo
      },
      orderBy: { id: 'asc' }
    });

    await prisma.serviceRequest.create({
      data: {
        id: ann.id,
        restaurantProfileId: ann.ristoranteId,
        servicePackageId: servicePackage ? servicePackage.id : null,
        requestedDate: new Date(`${ann.data}T12:00:00`),
        requestedSkills: ann.qualifiche || [],
        notes: ann.desc || '',
        status: 'open'
      }
    });
  } catch (error) {
    storageInfo.lastError = error.message;
  }

  return ann;
}

async function addAuditLog(user, action, tipo) {
  const entry = {
    time: new Date().toISOString().slice(0, 16).replace('T', ' '),
    user,
    action,
    tipo
  };
  auditLog.unshift(entry);

  const prisma = getPrismaClient();
  if (!prisma) return entry;

  try {
    const actor = users.find(item => item.email === entry.user);
    await prisma.auditLog.create({
      data: {
        actorUserId: actor ? actor.id : null,
        actorEmail: entry.user,
        actionKey: entry.tipo,
        targetTable: 'marketplace',
        contextPayload: {
          action: entry.action,
          time: entry.time
        }
      }
    });
  } catch (error) {
    storageInfo.lastError = error.message;
  }

  return entry;
}

async function updateCommissioni(nextValues) {
  const nextCommissioni = {
    servizio: nextValues.servizio !== undefined ? parseInt(nextValues.servizio, 10) : commissioni.servizio,
    giornata: nextValues.giornata !== undefined ? parseInt(nextValues.giornata, 10) : commissioni.giornata,
    evento: nextValues.evento !== undefined ? parseInt(nextValues.evento, 10) : commissioni.evento
  };
  replaceObject(commissioni, nextCommissioni);

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      await prisma.platformSetting.upsert({
        where: {
          settingKey: 'commissioni'
        },
        create: {
          settingKey: 'commissioni',
          valueJson: nextCommissioni
        },
        update: {
          valueJson: nextCommissioni
        }
      });
    } catch (error) {
      storageInfo.lastError = error.message;
    }
  }

  return clone(nextCommissioni);
}

async function setUserVerification(userId, isVerified) {
  const user = getUser(userId);
  if (!user) return null;

  user.verificato = Boolean(isVerified);

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { isVerified: Boolean(isVerified) }
      });
    } catch (error) {
      storageInfo.lastError = error.message;
    }
  }

  return user;
}

async function suspendUser(userId) {
  const user = getUser(userId);
  if (!user) return null;

  user.status = 'suspended';

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { status: 'suspended' }
      });
    } catch (error) {
      storageInfo.lastError = error.message;
    }
  }

  return user;
}

async function signContract(contractId, signerUserId, ipAddress) {
  const contratto = contratti.find(item => item.id === contractId);
  if (!contratto) return null;

  const prisma = getPrismaClient();
  if (!prisma) {
    return {
      contract: contratto,
      signedCount: 0,
      status: contratto.stato
    };
  }

  try {
    await prisma.contractSignature.upsert({
      where: {
        serviceContractId_signerUserId: {
          serviceContractId: contractId,
          signerUserId
        }
      },
      create: {
        serviceContractId: contractId,
        signerUserId,
        signedAt: new Date(),
        signatureProvider: 'demo_checkbox',
        ipAddress
      },
      update: {
        signedAt: new Date(),
        ipAddress
      }
    });

    const signatures = await prisma.contractSignature.count({
      where: {
        serviceContractId: contractId
      }
    });

    const nextStatus = signatures >= 2 ? 'signed' : 'awaiting_signature';
    await prisma.serviceContract.update({
      where: { id: contractId },
      data: { status: nextStatus }
    });

    return {
      contract: contratto,
      signedCount: signatures,
      status: nextStatus
    };
  } catch (error) {
    storageInfo.lastError = error.message;
    return {
      contract: contratto,
      signedCount: 0,
      status: contratto.stato
    };
  }
}

async function recomputeReviewAggregate(userId) {
  const prisma = getPrismaClient();
  if (!prisma) return null;

  const reviews = await prisma.review.findMany({
    where: { revieweeUserId: userId }
  });

  if (!reviews.length) {
    return null;
  }

  const reliabilityAvg = reviews.reduce((sum, item) => sum + item.reliability, 0) / reviews.length;
  const punctualityAvg = reviews.reduce((sum, item) => sum + item.punctuality, 0) / reviews.length;
  const professionalismAvg = reviews.reduce((sum, item) => sum + item.professionalism, 0) / reviews.length;
  const overallAvg = (reliabilityAvg + punctualityAvg + professionalismAvg) / 3;

  await prisma.reviewAggregate.upsert({
    where: { userId },
    create: {
      userId,
      reliabilityAvg,
      punctualityAvg,
      professionalismAvg,
      overallAvg,
      reviewCount: reviews.length
    },
    update: {
      reliabilityAvg,
      punctualityAvg,
      professionalismAvg,
      overallAvg,
      reviewCount: reviews.length
    }
  });

  const user = getUser(userId);
  if (user) {
    user.rating = Number(overallAvg.toFixed(2));
    user.ratingCount = reviews.length;
  }

  return {
    overallAvg,
    reviewCount: reviews.length
  };
}

async function rateContract(contractId, reviewerUserId, reviewerRole, rating, commento) {
  const contratto = contratti.find(item => item.id === contractId);
  if (!contratto) return null;

  const numericRating = parseInt(rating, 10);
  if (reviewerRole === 'cameriere') {
    contratto.valCam = numericRating;
  } else {
    contratto.valRist = numericRating;
    contratto.commentoRist = commento || null;
  }

  const revieweeUserId = reviewerRole === 'cameriere' ? contratto.ristoranteId : contratto.cameriereId;
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      await prisma.review.upsert({
        where: {
          serviceContractId_reviewerUserId: {
            serviceContractId: contractId,
            reviewerUserId
          }
        },
        create: {
          serviceContractId: contractId,
          reviewerUserId,
          revieweeUserId,
          reliability: numericRating,
          punctuality: numericRating,
          professionalism: numericRating,
          commentText: reviewerRole === 'ristorante' ? (commento || null) : null
        },
        update: {
          reliability: numericRating,
          punctuality: numericRating,
          professionalism: numericRating,
          commentText: reviewerRole === 'ristorante' ? (commento || null) : null
        }
      });

      await recomputeReviewAggregate(revieweeUserId);
    } catch (error) {
      storageInfo.lastError = error.message;
    }
  }

  return contratto;
}

function getUnreadCount(userId) {
  return messaggi.filter(m => m.to === userId && !m.read).length;
}

function getStorageInfo() {
  return { ...storageInfo };
}

resetFromSeed();

const ready = process.env.TAVOLOLIBERO_DISABLE_RUNTIME_HYDRATION === '1'
  ? Promise.resolve(storageInfo)
  : hydrateFromPrisma().catch(error => {
    storageInfo.lastError = error.message;
    return storageInfo;
  });

module.exports = {
  seed,
  ready,
  users,
  annunci,
  contratti,
  messaggi,
  alerts,
  auditLog,
  nonRenewal,
  commissioni,
  getUser,
  getUserByEmail,
  getCamerieri,
  getRistoranti,
  getContrattiForUser,
  getMessaggiForUser,
  getConversationPartners,
  getConversation,
  addMessage,
  markConversationRead,
  getAnnunciByRistorante,
  addAnnuncio,
  addAuditLog,
  updateCommissioni,
  setUserVerification,
  suspendUser,
  signContract,
  rateContract,
  getUnreadCount,
  getStorageInfo
};
