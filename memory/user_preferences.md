---
name: Preferenze lavoro utente TavoloLibero
description: Come l'utente (rossima) vuole collaborare — lingua, stile, autonomia, vincoli operativi
type: user
---

- Lingua: **italiano** per risposte, commit, documentazione. Codice e identifier in italiano dove già in uso (cameriere, ristorante, annunci).
- Paradigmi: **KISS, YAGNI, DRY**. Evitare over-engineering, feature flag inutili, astrazioni premature.
- Budget contesto: **mantenere ≤60-65%** della finestra. Delegare analisi pesanti a subagent (Explore/general-purpose) e ricevere report sintetici invece di leggere direttamente file lunghi.
- Delega decisionale: quando dice "decidi tu", decidere davvero e motivare — non rimbalzare la scelta indietro.
- Memory bank: l'utente ha menzionato un "memory bank MCP" installato; nella sessione attuale non è visibile tra gli MCP attivi (solo context7, pdfcrowd, Gmail/Calendar/Drive). Usare il sistema memory file-based in `memory/` di progetto. Se l'utente riferisce uno specifico MCP, chiedere il nome esatto per configurarlo.
