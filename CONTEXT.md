# Product Validator — Contesto di progetto

> Documento di riferimento per chiunque (umano o LLM) lavori su questo codebase.
> Va letto **prima** di fare modifiche architetturali. Le sezioni "Decisioni non
> negoziabili" e "Non-goals" descrivono scelte deliberate, non lacune.

---

## 1. Cos'è il prodotto

SaaS che analizza prodotti per dropshipper e brand ecommerce e produce un verdetto
di "vendibilità" tramite un agente AI multi-worker.

**Input utente**: un prodotto (link AliExpress/Amazon, o foto + descrizione) più
il proprio profilo operativo (budget mensile ads, canale di vendita, mercato
target, capacità di produrre creative).

**Output**: un report strutturato con score 0–100 mappato su scala cromatica,
verdetto narrativo, 3 punti di forza, 3 rischi, raccomandazione operativa,
breakdown per dimensione con confidence dei dati.

### Differenziazione vs competitor

I competitor (Minea, PiPiADS, Sell The Trend, Ecomhunt, Winning Hunter) mostrano
**cosa sta vendendo** basandosi su engagement aggregati di ads.

Product Validator dice **se questo prodotto può funzionare per te**, incrociando
domanda di mercato, saturazione, economia unitaria, fit con il setup utente, e
rischio legale/compliance.

Lo stesso prodotto produce score diversi per utenti con setup diverso. Questo è
il vantaggio competitivo principale.

---

## 2. Modello di business

Pricing ibrido (valori indicativi, non fissati):

- Pagamento una tantum per analisi singola: ~9,90€
- Abbonamento mensile: ~49€/mese con 25–50 analisi incluse

**Vincolo economico**: margine sopra il 100% rispetto ai costi variabili (API
Claude, scraping) in entrambi i modelli. Questo guida le scelte di caching e
fallback.

**Mercato target iniziale**: dropshipper italiani intermedi (fatturato
5–50k€/mese) e agenzie ecommerce. Acquisizione iniziale via TikTok organico +
ads su TikTok mirate all'algoritmo dropshipping, presenza in community
Telegram/Discord.

---

## 3. Architettura dell'agente AI

L'analisi è strutturata in **5 dimensioni di valutazione**, ognuna gestita da un
worker indipendente che gira in parallelo.

Ogni worker:
1. Raccoglie i propri dati (con fallback graceful a tre layer — vedi sezione 7).
2. Passa i dati a Claude per il reasoning con tool use validato Zod.
3. Ritorna un output strutturato con score 0–100 di dimensione, evidenze,
   warning, flag di disponibilità dati, e `dataConfidence`.

I 5 worker girano via `Promise.allSettled` con timeout per worker. Un worker
fallito (timeout, errore, rate limit) non blocca gli altri: viene marcato
`dataAvailable: false` con score neutro 50.

### Le 5 dimensioni con pesi

I pesi sono **hardcoded**, non configurabili. Sommano a 100.

#### D1 — Domanda di mercato (peso 20%)

Misura se esiste una domanda reale e sostenibile per il prodotto.

- Trend Google Trends a 90 giorni
- Volume di ricerca mensile stimato (sul prodotto e sul problema che risolve)
- Related rising queries
- Momentum sociale TikTok (hashtag, views)
- Problem-awareness score (giudizio qualitativo 0–100)

**Benchmark**: <1.000 ricerche/mese in IT = basso; 1.000–10.000 = medio;
\>10.000 = alto. Trend in calo del 30% YoY = penalità forte.

#### D2 — Saturazione (peso 20%)

Misura quanto il mercato è già attaccato.

- Numero di store competitor stimato
- Ads attive su Meta Ad Library
- Durata media delle ads (>30 giorni = mercato profittevole; <14 giorni =
  nessuno regge)
- Presenza di brand consolidati dominanti
- Market entry window

**Benchmark**: <20 store = early opportunity; 20–100 = competitivo; >200 =
saturo.

#### D3 — Economia unitaria (peso 30%, più pesante)

Misura se i numeri tornano per il setup utente.

- COGS stimato (fornito dall'utente o ricavato via search)
- Prezzo retail consigliato (markup 3–5x)
- Margine lordo
- CPM atteso da benchmark categoria
- CVR atteso, CPA atteso
- Break-even ROAS
- Profittabilità con il budget utente
- Tasso di reso atteso da benchmark categoria
- Classificazione categoria

**Benchmark**: markup minimo 3x; margine lordo target 65–70% (TrueProfit 2026);
soglie veto 30% e 50%.

#### D4 — Fit con utente (peso 15%)

È il vantaggio competitivo che i competitor non hanno: stesso prodotto, score
diverso a seconda del setup utente.

- Budget minimo di test: `max(300, 3 × CPA × 30 giorni)`
- Canale raccomandato
- Giorni stimati per validare
- Channel match score
- Creative capacity match

**Logica**:
- Prodotto impulse buy → TikTok Shop
- High-ticket → Shopify+Meta
- Problem-solving ricerca-driven → Shopify+Meta o Amazon
- Richiede video UGC + utente ha capacità "none" → red flag

#### D5 — Rischio (peso 15%)

Il worker `risk` ora valuta SOLO il **market risk** (return rate atteso,
qualità prodotto, sicurezza). Il rischio compliance/legale (categoria
ristretta, trademark, marcatura CE) è separato in un campo dedicato
`complianceAlert` del FinalReport e **NON** entra nel calcolo dello score.

**Market risk** (influenza score):
- Tasso reso atteso (lookup benchmark per categoria + segnali fonti)
- Problemi sicurezza prodotto / recall noti
- Segnalazioni qualità nelle fonti

**Compliance flag** (mostrato come banner separato, non incide su score):
- Categoria ristretta sulla piattaforma utente (lista nota Meta/TikTok)
- Trademark/brevetto check (low/medium/high)
- Conformità CE per elettronica/contact products

Il banner ha 3 livelli: `none` (tutto pulito), `warning` (CE required,
trademark medium — informativo), `critical` (categoria ristretta o
trademark high — bloccante per advertising).

### Aggregazione e regole di veto

**Score finale** = media pesata delle 5 dimensioni, con regole di veto
ECONOMICHE che dominano:

| Condizione | Cap score |
|---|---|
| Margine lordo < 30% | max 30 |
| Margine lordo < 50% | max 54 |
| Tasso reso atteso > 20% | max 54 |

Le veto rules **compliance** (categoria ristretta, trademark high) sono
state rimosse: il rischio compliance non cap-pa più lo score, ma viene
esposto come `complianceAlert` separato. L'utente decide come gestirlo
(canali alternativi, documentazione, ecc.).

**Mappatura cromatica**:

| Score | Colore |
|---|---|
| 85–100 | Verde acceso |
| 70–84 | Verde |
| 55–69 | Giallo |
| 40–54 | Arancione |
| 0–39 | Rosso |

Il "verde acceso" deve essere **raro** per mantenere credibilità. Se l'aggregator
emette verde acceso troppo spesso in test, c'è un bug nei pesi o nei veto.

L'aggregator, dopo aver calcolato lo score numerico, chiama Claude per produrre
il **verdetto narrativo**:
- `verdict` in 2 frasi
- 3 `strengths`
- 3 `risks` ordinati per gravità
- `recommendation` azionabile
- `breakdown` per dimensione con summary di 1 frase

Quando `dataIntegrity` globale è bassa (< 60%) o ≥2 dimensioni hanno confidence
"low"/"unknown", l'aggregator **modera il tono del verdict**, evitando
affermazioni perentorie.

---

## 4. Benchmark numerici 2026

Hardcoded in `src/benchmarks/`. Tutti i CPM/CPA sono **in USD** (così come escono
dalle fonti originali Triple Whale, TrueProfit, Statista 2026). La conversione a
EUR avviene **runtime nei worker** usando il tasso `USD_EUR = 0.92` definito in
`src/lib/utils.ts`. Non mischiare valute negli stessi file.

### CPM TikTok (USD per 1000 impression, in-feed)

retail 7.9, beauty 7.4, health_wellness 9.2, pets 8.1, home 9.5, fashion 11.0,
tech 10.5, fitness 9.8, default 9.16. Triple Whale ecommerce specifico: 13.26.

### CPM Meta (USD)

IT default 8.5, EU default 9.0, US default 14.19, GLOBAL default 10.
Variazioni per categoria: beauty 9.5, fashion 11, tech 10.

### CVR ecommerce

TikTok 2.0%, Meta 2.5%, default 2.2%.

### CPA TikTok ecommerce (USD)

pets 13.46, health_wellness 16.87, beauty 18.82, home 22, fashion 25, tech 28,
default 32.74.

### Tassi di reso per categoria

home/lifestyle 5%, tech 12%, fashion 10%, beauty 6%, fitness 8%, pets 4%,
default 10%. **Soglia veto 20%**.

### Soglie margine

- Veto rosso: < 30%
- Veto giallo: < 50%
- Target salutare: 65%
- Markup minimo: 3x

### Categorie ristrette piattaforme

weapons, supplements con health claims, CBD/cannabis, medical devices, adult,
gambling, tobacco/vape, alcolici (Meta strict, TikTok), political ads,
financial services strict (TikTok).

---

## 5. Stack tecnico

- **Next.js 15** App Router, TypeScript `strict`, Tailwind base
- **Prisma + SQLite** in locale. `DATABASE_URL` parametrizzato:
  `?connection_limit=1&socket_timeout=5`. Schema database-agnostic per swap
  futuro a Postgres senza modifiche.
- **@anthropic-ai/sdk** con Sonnet 4.5 default e Haiku 4.5 per task semplici
  (es. classificazione categoria, web search results parsing).
- **Zod** per validazione output strutturati LLM (sempre via tool use, mai
  parsing di testo libero).
- Esecuzione worker via `Promise.allSettled` con timeout per worker:
  - 45s demand/saturation (fanno web search)
  - 30s economics/risk (fanno web search più leggera)
  - 10s fit (no fonti esterne, solo logica)
- **Niente** Inngest, Supabase, Stripe, auth in fase locale.

### Costi token Claude (riferimento, verificare prima di fatturare)

- Sonnet 4.5: $3 input / $15 output per MTok
- Haiku 4.5: $1 input / $5 output per MTok
- Conversione USD→EUR: 0.92

Questi prezzi cambiano periodicamente. Per uso operativo verificare su
[anthropic.com/pricing](https://www.anthropic.com/pricing) prima di prendere
decisioni di pricing utente.

**Stima target costo per analisi**: 0.20–0.40€ in token Claude (da verificare
con prompt caching aggressivo da implementare in fase 2).

---

## 6. Decisioni architetturali non negoziabili

Queste sono scelte deliberate, motivate. Non vanno modificate senza una buona
ragione documentata.

### 6.1 Job runner astratto

La logica fire-and-forget è isolata dietro un'interfaccia `JobRunner` con
implementazione `LocalJobRunner` per dev locale e VPS persistenti.

**Motivo**: il fire-and-forget viene ucciso dalle lambda serverless quando
rispondi al client. Per Vercel/Lambda si swappa con Inngest/QStash senza toccare
il business logic.

### 6.2 Semaforo concorrenza Claude

Le chiamate API Claude passano per un semaforo async (`src/lib/concurrency.ts`),
configurabile via `CLAUDE_MAX_CONCURRENT` (default 4 in locale).

**Motivo**: senza semaforo, l'orchestrator può lanciare 10–15 chiamate parallele
all'inizio dell'analisi (5 worker × 2–3 sub-call ciascuno) e sbattere contro i
rate limit del Tier 1 di Anthropic. Il semaforo è **complementare al backoff,
non sostitutivo**: lavorano insieme.

### 6.3 Backoff esponenziale con jitter + Retry-After

Il client Anthropic gestisce retry max 3 su 5xx e 429.

Formula: `delay = base × 2^attempt + random(0, base × 2^attempt)`.

Se la response 429 contiene header `retry-after`, **quel valore ha precedenza**
sul backoff calcolato.

### 6.4 Pattern anti-allucinazione `QuantitativeEstimate`

Tutti i campi numerici incerti negli schemi Zod usano un discriminated union a
tre stati:

```ts
type QuantitativeEstimate =
  | { type: "observed"; value: number; source: string }
  | { type: "estimated_range"; min: number; max: number; rationale: string;
      confidence: "low" | "medium" | "high" }
  | { type: "unknown"; reason: string }
```

I prompt LLM sono **espliciti nel rifiutare di inventare numeri precisi**.
Forbice ragionevole con motivazione, oppure "unknown" onesto, sono preferibili a
un secco numero plausibile ma falso.

**Questa è la differenza più importante rispetto ai competitor.** Mai compromettere.

### 6.5 Confidence per dimensione

Ogni `WorkerOutput` espone un campo `dataConfidence` (`high` / `medium` / `low`
/ `unknown`) propagato fino al report finale e mostrato come badge nell'UI
(es. "dati: alta/media/bassa/sconosciuta").

L'aggregator modera il tono del verdict quando `dataIntegrity` globale è bassa.

### 6.6 Database-agnostic

Niente raw SQL, niente feature SQLite-specifiche. Solo Prisma Client API
standard. Lo swap a Postgres richiede solo cambio di provider e `DATABASE_URL`.

### 6.7 Cost tracking dal giorno 1

Ogni chiamata Claude logga `inputTokens`, `outputTokens`, costo in EUR. Il
`totalCostEur` per analisi è la somma reale, non una stima.

### 6.8 Logging strutturato JSON

Niente `console.log` testuali sparsi. Eventi chiave con
`console.log(JSON.stringify({ event, ...context }))` così sono grep-abili e
parserabili.

---

## 7. Strategia data sources

Tre layer di fallback graceful:

### Layer 1 — API ufficiali (quando disponibili)

- Meta Ad Library (gratis, rate-limited)
- Keepa per Amazon (~17€/mese)
- DataForSEO o SerpAPI per Google Trends
- EUIPO/USPTO per trademark

### Layer 2 — Apify per scraping pesante

TikTok, Shopify store, AliExpress. ~0.10–0.40€ per actor run, gestisce proxy e
captcha.

### Layer 3 — Web search Anthropic come fallback universale

Il tool `web_search` integrato nell'API Anthropic per news, dati non
strutturati, e quando le altre fonti falliscono.

`searchWeb` usa **Haiku 4.5** (la ricerca è raccolta, il reasoning lo fa il
worker che la chiama, su Sonnet 4.5).

### Caching aggressivo

Tabella `Cache` su SQLite con TTL configurabile (default 7 giorni per dati di
mercato). Chiave normalizzata via hash dell'input. Un secondo utente che
analizza lo stesso prodotto entro 7 giorni vede risultato cached **gratis**.

### Strategia per MVP locale

Tutti gli stub di fonti specifiche (`google-trends.ts`, `meta-ads.ts`,
`apify.ts`) controllano se la env var corrispondente è settata:

- Se sì → usano l'API reale (placeholder "not implemented yet" per ora)
- Se no → fallback a `searchWeb`

Questo permette di sviluppare e testare senza spendere su fonti esterne, e di
attivarle gradualmente quando ha senso commercialmente.

---

## 8. Struttura cartelle target

```
product-validator/
├── prisma/schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx (form), globals.css
│   │   ├── analyze/[jobId]/page.tsx (report)
│   │   └── api/
│   │       ├── analyze/route.ts (POST, fire-and-forget tramite jobRunner)
│   │       └── job/[jobId]/route.ts (GET stato + result)
│   ├── lib/
│   │   ├── db.ts (Prisma singleton)
│   │   ├── anthropic.ts (client + retry + jitter + semaforo + cost)
│   │   ├── env.ts (validazione Zod)
│   │   ├── utils.ts (withTimeout, sleep, hashInput, cn, USD_EUR)
│   │   ├── concurrency.ts (claudeSemaphore)
│   │   └── job-runner.ts (interfaccia + LocalJobRunner)
│   ├── agent/
│   │   ├── orchestrator.ts
│   │   ├── aggregator.ts
│   │   ├── types.ts
│   │   ├── schemas.ts (con QuantitativeEstimate)
│   │   └── workers/
│   │       ├── demand.ts, saturation.ts, economics.ts, fit.ts, risk.ts
│   ├── data-sources/
│   │   ├── web-search.ts (fallback universale)
│   │   ├── google-trends.ts, meta-ads.ts, apify.ts (stub con fallback)
│   │   └── cache.ts
│   └── benchmarks/
│       ├── cpm-cpc.ts, return-rates.ts, restricted-categories.ts,
│       │   margin-thresholds.ts
└── README.md
```

---

## 9. Schema database

Due modelli Prisma, compatibili sia SQLite che Postgres senza modifiche.

### `Analysis`

`id` (cuid), `productUrl?`, `productName`, `productDescription?`, `productCogs?`,
`userBudget`, `userChannel`, `userMarket`, `userCreativeCapacity`, `status`
(`pending`/`running`/`completed`/`failed`), `result` (JSON serializzato),
`errorMessage?`, `totalCostEur?`, `dataIntegrity?`, `createdAt`, `startedAt?`,
`completedAt?`.

### `Cache`

`key` (PK), `value` (JSON), `expiresAt`, `createdAt`.

---

## 10. Tipo input utente

```ts
type AnalysisInput = {
  productUrl?: string
  productName: string                      // required
  productDescription?: string
  productCogs?: number                     // EUR
  userBudget: number                       // EUR mensili
  userChannel: "tiktok_shop" | "shopify_meta" | "shopify_tiktok" | "amazon_fba"
  userMarket: "IT" | "EU" | "US" | "GLOBAL"
  userCreativeCapacity: "none" | "images_only" | "ugc_video"
}
```

---

## 11. Scope: cosa fare e cosa non fare

### Da implementare con cura particolare

- Retry logic con jitter + Retry-After header
- Schemi Zod con `QuantitativeEstimate` per ogni campo numerico incerto
- Istruzioni anti-allucinazione esplicite nei prompt dei worker (specialmente
  `demand` e `saturation`)
- Job runner astratto pronto per swap futuro
- Logging cost-per-call dal giorno 1

### Non-goals (NON implementare in questa fase)

- Auth/login (sviluppatore solo che testa)
- Stripe / pagamenti / sistema crediti
- Unit test (validazione manuale)
- shadcn/ui o librerie UI complesse
- Job queue tipo Inngest (`LocalJobRunner` basta per locale)
- Supabase (SQLite locale)
- Deploy
- **Prompt caching Anthropic** (ottimizzazione fase 2, non bloccante per MVP)
- **Streaming responses** (l'UI fa polling, non serve)
- **Osservabilità tipo Langfuse / Helicone** (logging JSON basta per ora)
- **Retry automatico dell'analisi fallita** (utente la rilancia a mano)

Aggiungere uno di questi senza discussione preventiva è una violazione di scope.

---

## 12. Glossario rapido (per chi non viene dal mondo dropshipping)

| Termine | Significato |
|---|---|
| **COGS** | Cost Of Goods Sold. Costo di acquisto del prodotto (es. AliExpress) per unità venduta. |
| **CPM** | Cost Per Mille. Costo per 1000 impression pubblicitarie. Misura quanto costa farsi vedere. |
| **CPC** | Cost Per Click. Costo per ogni click su un'ad. |
| **CPA** | Cost Per Acquisition. Costo medio per acquisire un cliente pagante. |
| **CVR** | Conversion Rate. % di visitatori che completano un acquisto. |
| **ROAS** | Return On Ad Spend. Ricavi / Spesa pubblicitaria. ROAS 3 = ogni 1€ speso ne torna 3. |
| **Break-even ROAS** | ROAS minimo per non essere in perdita, dato il margine lordo. = 1 / margine_netto. |
| **UGC** | User Generated Content. Video tipicamente in stile testimonianza, girati con smartphone. Standard de facto per ads TikTok/Reels. |
| **Markup** | Moltiplicatore tra COGS e prezzo retail. Markup 3x = vendi a 3 volte il costo. |
| **Margine lordo** | (Prezzo - COGS) / Prezzo. % di ogni vendita disponibile prima di ads e overhead. |
| **Dropshipping** | Modello in cui il merchant vende senza tenere magazzino: ordina al fornitore solo dopo la vendita. |
| **Meta Ad Library** | Database pubblico di Meta con tutte le ads attive. Fonte primaria per analisi saturazione. |
| **Veto / Veto rule** | Regola che forza un cap sullo score finale a prescindere dalla media pesata. |

---

## 13. Note operative

- **Costo Anthropic per partire**: minimo 5€, raccomandati 10–15€ per non
  ricaricare ai primi test.
- **Tutto il resto in free tier**: Vercel (quando deployerai), Apify free tier
  5$/mese se serve.
- **Sviluppo locale solo**: niente deploy in questa fase, niente domini, niente
  certificati.
