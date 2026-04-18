---
name: Regole compliance inviolabili TavoloLibero
description: Vincoli legali italiani non negoziabili su linguaggio, matching e pagamenti — violarli espone il progetto al rischio "finta P.IVA"
type: feedback
---

Nel codice, DB, PDF, UI di TavoloLibero applicare sempre:

**1. Lessico autonomo obbligatorio.** Mai "assunzione", "stipendio", "datore di lavoro", "turno fisso". Usare sempre: "committente", "prestatore d'opera", "compenso", "pacchetto servizio", "incarico".

Why: la Riforma Fornero presume subordinazione su base lessicale+comportamentale. Usare termini da lavoro dipendente in un contratto autonomo è auto-denuncia.
How to apply: al primo riscontro di termini vietati in EJS, schema Prisma, PDF, risposte utente → bloccare o rinominare. `contract-agent.js` ha già `forbidden terms validation`: riusare quella lista, non reinventarla.

**2. Rotazione forzata anti-monocommittenza.** L'algoritmo di matching DEVE nascondere ristoranti a un freelance se concentrazione fatturato 12m/24m con quel locale supera soglia di warning (70% safety margin sull'80% legale) o giorni superano soglia di warning (200 safety margin sui 241 legali).

Why: presunzione di subordinazione scatta oltre ~241gg/24m o ~80% fatturato. Safety margin serve per non arrivare mai alla soglia legale.
How to apply: `lib/compliance-agent.js` già calcola queste metriche e ritorna MatchDecision. Le soglie attuali (240/80%) vanno abbassate a 200/70% o rese configurabili con default safety. Il middleware di matching deve filtrare a livello di query, non solo avvisare.

**3. Architettura pagamenti: split payment obbligatorio.** La piattaforma incassa dal ristorante e ripartisce (fee + netto al freelance) via Stripe Connect. Mai flussi in cui la piattaforma "paga il cameriere come prestazione d'opera dell'app".

Why: se la piattaforma paga direttamente come datore, è lei il datore di lavoro de facto. Split payment tiene la piattaforma come intermediario/marketplace.
How to apply: `lib/payment-agent.js` è il punto di estensione. Serve BankAccount model (manca), webhook Stripe, e payout idempotente. Ogni proposta di flusso pagamento va letta con questa lente.

**4. DAC7 reporting.** La piattaforma deve raccogliere dati fiscali venditori (camerieri) + coordinate bancarie per comunicazioni obbligatorie Agenzia delle Entrate sopra soglia (€2000 o 30 transazioni/anno per seller UE).

Why: obbligo EU dal 2023, sanzioni piattaforma se assente.
How to apply: estendere `TaxProfile` con campi fiscali completi e aggiungere flag `reportable` su transaction/invoice. Non esiste ancora nello schema.

**5. GDPR: piattaforma è Titolare del Trattamento, non datore di lavoro.** Conseguenza di design: informativa privacy, consensi espliciti (già c'è `Consent` model minimale), DPA con Stripe, retention policy.

**6. Marketplace NON è sostituto d'imposta.** TavoloLibero è marketplace intermediario puro (art. 23 DPR 600/73): il contratto di prestazione è tra worker e ristorante (art. 2222 C.c.), la piattaforma facilita e trattiene commissione. La **ritenuta d'acconto 20%** (per `autonomo_occasionale` e `partita_iva_ordinaria`) la trattiene il **ristorante** dal pagamento che fa alla piattaforma, e la versa con F24 cod. 1040 entro il 16 del mese successivo. Rilascia la CU al worker entro il 16 marzo anno successivo.

Why: se la piattaforma trattenesse e versasse la ritenuta, assumerebbe il ruolo di sostituto d'imposta e renderebbe il modello Merchant of Record (MOR), con obbligo di P.IVA marketplace, LIPE, 770, CU — overkill per un marketplace intermediario.

How to apply: `lib/tax-calculator.js` calcola gli importi; `lib/payment-agent.js` li persiste su Invoice/Payout/EscrowLedger e scrive `StripeEvent(withholding.reported)` per audit. Nessun cash della ritenuta passa dalla piattaforma. Nelle UI/PDF mai scrivere "trattieni la ritenuta" o "versiamo per te": il marketplace la **evidenzia**, il ristorante la **versa**. Sub-progetto 2c esporrà un report F24 aggregato al ristorante.

Ragionamento fiscale esteso in skill `finance/commercialista-italiano`. Prima di andare in produzione, validazione vincolante con commercialista iscritto all'albo.
