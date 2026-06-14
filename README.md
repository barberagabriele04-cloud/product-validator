# Product Validator

SaaS che analizza prodotti per dropshipper e brand ecommerce e produce un verdetto di "vendibilità" tramite un agente AI multi-worker. Per dettagli su prodotto, architettura, benchmark e roadmap vedi [`CONTEXT.md`](./CONTEXT.md).

## Setup locale

```bash
cp .env.example .env.local
# riempi ANTHROPIC_API_KEY in .env.local

npm install
npm run db:migrate     # crea dev.db e applica le migration
npm run dev            # http://localhost:3000
```

Comandi utili:

- `npm run lint` — type check stretto (`tsc --noEmit`)
- `npm run build` — build di produzione
- `npm run db:studio` — Prisma Studio per ispezionare dev.db

## Stato attuale

Implementato (MVP locale funzionante):

- **Infrastruttura trasversale**: env validation (Zod), semaforo concorrenza Claude, retry con jitter + `Retry-After`, cost tracking per chiamata, job runner astratto (`LocalJobRunner`).
- **Agente AI**: i 5 worker (`demand` / `saturation` / `economics` / `fit` / `risk`), orchestrator con `Promise.allSettled` + timeout per worker, aggregator con regole di veto e verdetto narrativo. Schemi Zod con pattern anti-allucinazione `QuantitativeEstimate`.
- **Data sources**: web search Anthropic come fallback universale, stub `google-trends` / `meta-ads` / `apify` con attivazione via env var, cache su SQLite.
- **API & UI**: route `POST /api/analyze` (fire-and-forget) e `GET /api/job/[jobId]` (stato + result), pagina form e pagina report con polling, export PDF (`GET /api/job/[jobId]/pdf`).

Da fare (vedi `CONTEXT.md` sezione 11): prompt caching aggressivo, telemetria costi avanzata, hardening, attivazione delle data source reali (Apify / Meta Ad Library / Keepa / SerpAPI).

> **Nota**: per testare serve una propria `ANTHROPIC_API_KEY` in `.env.local` (vedi `.env.example`). Nessuna chiave è inclusa nel repository.
