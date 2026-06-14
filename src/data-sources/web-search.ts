// Layer 3 di data sources (CONTEXT.md sez. 7): fallback universale via tool
// web_search nativo Anthropic. Usa Haiku 4.5 perché la ricerca è raccolta;
// il reasoning resta al worker chiamante (su Sonnet 4.5).
//
// Pattern anti-allucinazione:
// - System prompt obbliga a citare fonti, segnalare unknown, etichettare
//   confidence (CONTEXT.md sez. 6.4).
// - Output forzato via tool use `report_findings` con schema rigido.
// - searchWeb non lancia mai eccezioni: errori → SearchResult vuoto + log.
//
// Cost optimization (mini-checkpoint Phase 2):
// - max_uses ridotto da 5 a 2 per forzare ricerche più mirate.
// - Cache wrap: hit → costEur 0; miss → live + write su cache (TTL 7gg).

import type Anthropic from "@anthropic-ai/sdk"
import { callClaude, type ServerTool } from "@/lib/anthropic"
import { SearchResultSchema } from "@/agent/schemas"
import type { SearchResult } from "@/agent/types"
import { cacheGet, cacheSet } from "@/data-sources/cache"
import { hashInput } from "@/lib/utils"

const SYSTEM_PROMPT = `Sei un assistente di ricerca per validazione prodotti ecommerce. Regole assolute:

1. Riporta solo info trovate in fonti consultate, cita la fonte per ogni claim.
2. Se non trovi un dato, mettilo in notFound. Mai inventare numeri plausibili.
3. Per dati quantitativi, riporta la forbice esatta della fonte, non un punto medio.
4. Distingui claim "observed" (visti in fonte), "inferred" (dedotti), "uncertain" (qualità dubbia).
5. Segnala fonti datate (>2 anni) o di bassa qualità.
6. Output strutturato via tool use, mai prosa libera.`

// Server tool nativo Anthropic. SDK 0.32.1 non tipa questo shape — è la forma
// documentata accettata dall'API. Versione tool: web_search_20250305 (stabile).
const DEFAULT_MAX_USES = 2

function buildWebSearchTool(maxUses: number): ServerTool {
  return {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: maxUses,
  }
}

const REPORT_FINDINGS_TOOL: Anthropic.Tool = {
  name: "report_findings",
  description:
    "Riporta i risultati strutturati della ricerca. Da chiamare DOPO aver completato eventuali web_search, come step finale obbligatorio.",
  input_schema: {
    type: "object",
    properties: {
      findings: {
        type: "array",
        description: "Affermazioni fattuali con fonte e confidence",
        items: {
          type: "object",
          properties: {
            claim: { type: "string", description: "Affermazione fattuale" },
            source: { type: "string", description: "URL o nome fonte citata" },
            confidence: {
              type: "string",
              enum: ["observed", "inferred", "uncertain"],
              description:
                "observed = visto direttamente in fonte; inferred = dedotto; uncertain = fonte di qualità dubbia",
            },
          },
          required: ["claim", "source", "confidence"],
        },
      },
      notFound: {
        type: "array",
        description:
          "Aspetti richiesti dalla query ma NON trovati in fonti affidabili. Stringhe descrittive in italiano.",
        items: { type: "string" },
      },
    },
    required: ["findings", "notFound"],
  },
}

export interface SearchWebArgs {
  query: string
  contextHint?: string
  /**
   * Numero massimo di chiamate web_search consentite all'API agent loop.
   * Valore alto (4) = raccolta più ricca ma più costosa; basso (2) = veloce
   * e conservativo. Default 2.
   */
  maxUses?: number
  /**
   * TTL della cache hit per QUESTA chiamata in giorni. Default 7.
   * Demand/saturation per dropshipping TikTok dovrebbero passare 2 (i
   * mercati cambiano in 24-72h). Economics/risk possono usare il default
   * (dati lenti). NON viene incluso nella cache key — chiamate con TTL
   * diversi condividono la stessa entry.
   */
  ttlDays?: number
  /**
   * AbortSignal opzionale propagato fino al messages.create dell'SDK.
   * Quando aborted (es. worker chiamante in timeout), la chiamata HTTP è
   * cancellata e questa funzione ritorna fast con SearchResult degraded
   * — niente più late completions billable.
   */
  signal?: AbortSignal
}

const ReportFindingsInputSchema = SearchResultSchema.pick({
  findings: true,
  notFound: true,
})

// Schema di ciò che salviamo in cache. NON include `source` (che è un flag di
// run-time aggiunto al return) né `query` (è già parte della cache key).
const CachedSearchPayloadSchema = SearchResultSchema.pick({
  findings: true,
  notFound: true,
  costEur: true,
})

const SEARCH_CACHE_TTL_DAYS = 7

interface SearchCacheKey {
  // Versione della key per invalidare il cache se cambia lo schema in futuro.
  // v2: aggiunto maxUses (risultati possono differire al variare del numero
  // di chiamate web_search ammesse).
  kind: "searchWeb_v2"
  query: string
  contextHint: string | null
  maxUses: number
}

function buildCacheKey(args: SearchWebArgs, maxUses: number): SearchCacheKey {
  return {
    kind: "searchWeb_v2",
    query: args.query,
    contextHint: args.contextHint ?? null,
    maxUses,
  }
}

function buildUserPrompt(query: string, contextHint: string | undefined): string {
  const lines: string[] = []
  if (contextHint !== undefined) lines.push(`Contesto: ${contextHint}`)
  lines.push(`Query: ${query}`)
  lines.push("")
  lines.push(
    "Usa web_search per raccogliere informazioni rilevanti, poi chiama report_findings come step finale obbligatorio. Se la ricerca non produce risultati affidabili, chiama report_findings con findings vuoto e popola notFound.",
  )
  return lines.join("\n")
}

async function tryCacheGet(
  cacheKey: SearchCacheKey,
  query: string,
): Promise<SearchResult | null> {
  try {
    const raw = await cacheGet<unknown>(cacheKey)
    if (raw === null) return null
    const parsed = CachedSearchPayloadSchema.safeParse(raw)
    if (!parsed.success) {
      console.log(
        JSON.stringify({
          event: "search_cache_invalid_payload",
          query,
          errors: parsed.error.flatten(),
        }),
      )
      return null
    }
    const hashedKey = hashInput(cacheKey)
    console.log(
      JSON.stringify({ event: "search_cache_hit", query, hashedKey }),
    )
    return {
      query,
      findings: parsed.data.findings,
      notFound: parsed.data.notFound,
      costEur: 0,
      source: "cache",
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(
      JSON.stringify({ event: "search_cache_get_error", query, error: message }),
    )
    return null
  }
}

async function tryCacheSet(
  cacheKey: SearchCacheKey,
  payload: { findings: SearchResult["findings"]; notFound: string[]; costEur: number },
  query: string,
  ttlDays: number,
): Promise<void> {
  try {
    await cacheSet(cacheKey, payload, ttlDays)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(
      JSON.stringify({ event: "search_cache_set_error", query, error: message }),
    )
  }
}

export async function searchWeb(args: SearchWebArgs): Promise<SearchResult> {
  const {
    query,
    contextHint,
    maxUses = DEFAULT_MAX_USES,
    ttlDays = SEARCH_CACHE_TTL_DAYS,
    signal,
  } = args
  const cacheKey = buildCacheKey(args, maxUses)

  const cached = await tryCacheGet(cacheKey, query)
  if (cached !== null) return cached

  const userPrompt = buildUserPrompt(query, contextHint)
  const webSearchTool = buildWebSearchTool(maxUses)

  try {
    const result = await callClaude({
      model: "haiku-4-5",
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      tools: [webSearchTool, REPORT_FINDINGS_TOOL],
      maxTokens: 4096,
      signal,
    })

    for (const block of result.content) {
      if (block.type !== "tool_use") continue
      if (block.name !== "report_findings") continue
      const parsed = ReportFindingsInputSchema.safeParse(block.input)
      if (!parsed.success) {
        console.log(
          JSON.stringify({
            event: "search_web_invalid_tool_input",
            query,
            errors: parsed.error.flatten(),
          }),
        )
        continue
      }
      const payload = {
        findings: parsed.data.findings,
        notFound: parsed.data.notFound,
        costEur: result.usage.costEur,
      }
      await tryCacheSet(cacheKey, payload, query, ttlDays)
      return {
        query,
        findings: payload.findings,
        notFound: payload.notFound,
        costEur: payload.costEur,
        source: "live",
      }
    }

    // Il modello non ha chiamato report_findings (text-response, oppure si è
    // fermato dopo solo web_search). Non è un errore di sistema: degradiamo.
    // NON cachiamo questo risultato — un retry futuro potrebbe avere successo.
    console.log(
      JSON.stringify({
        event: "search_web_no_findings",
        query,
        reason: "model_did_not_call_report_findings",
        costEur: result.usage.costEur,
      }),
    )
    return {
      query,
      findings: [],
      notFound: [query],
      costEur: result.usage.costEur,
      source: "live",
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(
      JSON.stringify({ event: "search_web_error", query, error: message }),
    )
    return {
      query,
      findings: [],
      notFound: [query],
      costEur: 0,
      source: "live",
    }
  }
}
