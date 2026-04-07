# Prisma and SQLite setup

Il progetto ora usa Prisma con SQLite locale come alternativa a PostgreSQL. Il database vive in un file locale e non richiede servizi esterni.

## Cosa copre

- identity, consensi e sessioni
- profili worker e ristoranti
- skill, certificazioni, ex datori e snapshot fiscali
- service packages e service requests
- matching, chat e workflow
- contratti, firme, split payment, payout e invoice
- pair metrics, snapshot compliance, alert e review

## Bootstrap locale

1. Il file `.env` punta gia a:

```bash
DATABASE_URL="file:./dev.db"
```

2. Genera il client Prisma:

```bash
npm run db:generate
```

3. Crea o aggiorna il database SQLite:

```bash
npm run db:push
```

4. Carica il seed demo:

```bash
npm run db:seed
```

## Script disponibili

- `npm run db:validate`
- `npm run db:generate`
- `npm run db:push`
- `npm run db:seed`
- `npm run db:studio`

## Dataset usato

Il seed Prisma legge il dominio corrente dal demo:

- `data/mock-seed.js`
- `data/mock.js`
- `data/marketplace-service.js`

In questo modo mock runtime e database locale partono dallo stesso dataset.

## Nota pratica

Il runtime Express attuale continua a usare l'in-memory store per non introdurre regressioni sui flussi demo gia verificati. Il database SQLite e pronto e popolabile subito; il passo successivo, se vuoi, e collegare le route a repository Prisma uno slice alla volta.
