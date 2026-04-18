# Legal & Billing Audit

## Stato iniziale

- Il motore demo di compliance calcolava `days24m` e `share24m` nel service layer in modo non idoneo a un enforcement rigido.
- `FormerEmployer` era presente a schema ma non interveniva nel matching.
- `safeHarborCandidate` attenuava solo alcuni warning, senza una semantica chiara di esenzione.
- `ServiceContract`, `PaymentOrder` e `Invoice` erano modellati come one-shot: un contratto, un pagamento, un payout.
- Non esistevano milestone mensili, termini `0/15/30/45`, `pdfUrl` contrattuale o scheduler di billing.

## Interventi introdotti

### ComplianceAgent

File: `lib/compliance-agent.js`

- Policy runtime data-driven caricata da `PolicyRule`.
- Blocco rigido su:
  - `240` giorni worker-ristorante negli ultimi `24` mesi.
  - `80%` di concentrazione su un solo committente negli ultimi `24` mesi.
  - ex datore negli ultimi `24` mesi.
- `isSeniorExempt`/`safeHarborCandidate` trattati come esclusione dai blocchi automatici secondo regola di prodotto richiesta.
- Supporto a valutazione predittiva con proposta futura (`taxableAmountEur`, `estimatedServiceDays`).
- Persistenza in `PairMetric`, `ComplianceSnapshot`, `ComplianceAlert`.

### ContractAgent

File: `lib/contract-agent.js`

- Genera contratti lunghi multi-mese con milestone mensili.
- Titolo PDF fissato a:
  - `Contratto di Prestazione d'Opera Autonoma ex art. 2222 C.c.`
- Filtra lessico non consentito nel testo di input.
- Produce PDF pronto alla firma in `output/pdf/contracts`.
- Aggiorna `pdfUrl` sul contratto.

### PaymentAgent

File: `lib/payment-agent.js`

- Genera milestone mensili con scadenza a `0/15/30/45` giorni.
- Supporta base scadenza:
  - `invoice_date`
  - `end_of_month`
- Crea `PaymentOrder` e `Invoice` per ogni milestone maturata.
- Simula split payment piattaforma/professionista.
- Rilascia payout e ledger entries alla cattura.
- Espone scheduler richiamabile via script o bootstrap server.

## Schema aggiornato

File: `prisma/schema.prisma`

- Nuovi enum:
  - `EngagementType`
  - `PaymentTermsDays`
  - `PaymentTermsBase`
  - `MilestoneStatus`
  - `InvoiceStatus`
- `WorkerProfile`
  - aggiunto `isSeniorExempt`
- `ServiceRequest`
  - aggiunti campi per richiesta lunga e payment terms
- `ServiceContract`
  - aggiunti `engagementType`, `objectiveSummary`, `scopeOfWorkJson`, `serviceStartDate`, `serviceEndDate`, `estimatedServiceDays`, `monthlyGrossAmountEur`, `paymentTermsDays`, `paymentTermsBase`, `billingFrequency`, `pdfUrl`, `contractSnapshot`
- nuovo modello `ContractMilestone`
- `PaymentOrder`
  - da 1:1 a N:1 verso contratto
  - collegamento opzionale a `ContractMilestone`
- `Invoice`
  - ora lega anche contratto e milestone
  - aggiunti `invoiceStatus`, `dueDate`, `paidAt`, `pdfUrl`, `paymentTermsDays`, `paymentTermsBase`

## Endpoint introdotti

File: `routes/api.js`

- `POST /api/contracts/compliance-check`
- `POST /api/contracts/long-term`
- `POST /api/payments/billing/run`
- `GET /api/compliance/pairs/:workerId/:restaurantId`
  - ora usa il motore Prisma quando disponibile

## Script utili

- `npm run db:generate`
- `npm run db:push -- --accept-data-loss`
- `npm run db:seed`
- `npm run payments:run`

## Note operative

- Il PDF contrattuale viene servito via `/output/...` dal server Express.
- Lo scheduler di billing puo essere acceso in-process con:
  - `ENABLE_PAYMENT_AGENT_SCHEDULER=true`
  - `PAYMENT_AGENT_INTERVAL_MS=<millisecondi>`
- In produzione e preferibile un job esterno o una queue dedicata rispetto a `setInterval`.
