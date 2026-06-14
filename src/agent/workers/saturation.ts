// Worker D2 — Saturazione (CONTEXT.md sez. 3 D2, peso 20%).
//
// Pattern simile a demand:
// 1. fetchMetaAds (Layer 1 stub → searchWeb).
// 2. Se findings rilevanti < soglia, fetchShopifyStores (Layer 2 stub).
// 3. Sonnet 4.5 con tool use forzato struttura SaturationData.
// 4. computeSaturationScore deterministico applica i benchmark.

import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { callClaude } from "@/lib/anthropic"
import { withTimeout } from "@/lib/utils"
import { fetchMetaAds } from "@/data-sources/meta-ads"
import { fetchShopifyStores } from "@/data-sources/apify"
import { SaturationDataSchema } from "@/agent/schemas"
import type {
  AnalysisInput,
  SaturationData,
  SearchResult,
  WorkerOutput,
} from "@/agent/types"

// Deviazione da CONTEXT.md sez. 5: misurato empiricamente che saturation
// richiede 130-140s con max_uses=4 e CLAUDE_MAX_CONCURRENT=4. 150s dà
// buffer p99.
const TIMEOUT_MS = 150_000
const TOOL_NAME = "report_saturation"
const SEARCH_MAX_USES = 4
const SECOND_SEARCH_THRESHOLD = 5
// TTL cache più stretto: saturazione TikTok cambia in 24-72h.
const SEARCH_TTL_DAYS = 2

const REPORT_SATURATION_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Riporta il risultato strutturato della valutazione 'Saturazione' del mercato.",
  input_schema: {
    type: "object",
    properties: {
      data: {
        type: "object",
        properties: {
          activeAdsCount: {
            description:
              "Numero stimato di ads attive sulla piattaforma. NON tentare numeri precisi: di norma 'estimated_range' o 'unknown'. 'observed' SOLO se la fonte cita esplicitamente un conteggio.",
            oneOf: [
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["observed"] },
                  value: { type: "number" },
                  source: { type: "string" },
                },
                required: ["type", "value", "source"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["estimated_range"] },
                  min: { type: "number" },
                  max: { type: "number" },
                  rationale: { type: "string" },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["type", "min", "max", "rationale", "confidence"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["unknown"] },
                  reason: { type: "string" },
                },
                required: ["type", "reason"],
              },
            ],
          },
          avgAdRuntimeDays: {
            description:
              "Durata media in giorni delle ads attive. Same anti-hallucination rules.",
            oneOf: [
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["observed"] },
                  value: { type: "number" },
                  source: { type: "string" },
                },
                required: ["type", "value", "source"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["estimated_range"] },
                  min: { type: "number" },
                  max: { type: "number" },
                  rationale: { type: "string" },
                  confidence: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["type", "min", "max", "rationale", "confidence"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["unknown"] },
                  reason: { type: "string" },
                },
                required: ["type", "reason"],
              },
            ],
          },
          competingStoresEstimate: {
            type: "string",
            enum: ["low", "medium", "high", "saturated", "unknown"],
            description:
              "Categoria qualitativa basata su segnali indiretti (numero brand citati, ricorrenza prodotto).",
          },
          dominantBrandsPresent: {
            description:
              "true se ci sono brand consolidati che dominano; false se mercato frammentato; 'unknown' se non hai segnali.",
            oneOf: [
              { type: "boolean" },
              { type: "string", enum: ["unknown"] },
            ],
          },
          dominantBrandsList: {
            type: "array",
            items: { type: "string" },
            description: "Brand citati dalle fonti. Vuoto se non rilevati.",
          },
          marketEntryWindow: {
            type: "string",
            enum: ["open", "narrowing", "closed", "unknown"],
            description:
              "Finestra di ingresso: 'open' = mercato non saturo, 'narrowing' = competizione in crescita, 'closed' = troppo tardi.",
          },
          sourcesConsulted: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "activeAdsCount",
          "avgAdRuntimeDays",
          "competingStoresEstimate",
          "dominantBrandsPresent",
          "dominantBrandsList",
          "marketEntryWindow",
          "sourcesConsulted",
        ],
      },
      evidence: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" },
      },
      warnings: {
        type: "array",
        items: { type: "string" },
      },
      dataConfidence: {
        type: "string",
        enum: ["high", "medium", "low"],
      },
    },
    required: ["data", "evidence", "warnings", "dataConfidence"],
  },
}

const SaturationToolInputSchema = z.object({
  data: SaturationDataSchema,
  evidence: z.array(z.string()).min(3).max(5),
  warnings: z.array(z.string()),
  dataConfidence: z.enum(["high", "medium", "low"]),
})

function logJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

function buildSystemPrompt(): string {
  return [
    "Sei l'analista che valuta la dimensione \"Saturazione di mercato\" per un prodotto ecommerce.",
    "Hai ricevuto risultati di ricerca su Meta Ad Library e (opzionalmente) store Shopify.",
    "",
    "DISCIPLINA ANTI-ALLUCINAZIONE AGGRESSIVA (CONTEXT.md sez. 6.4):",
    "- Contare con precisione store Shopify attivi o ads attive nella Meta Ad Library è IMPOSSIBILE via ricerca web generica.",
    "- NON tentare numeri precisi. Per activeAdsCount e avgAdRuntimeDays, default è 'estimated_range' o 'unknown'.",
    "- 'observed' SOLO se trovi un articolo che cita ESPLICITAMENTE un numero verificabile.",
    "- Per competingStoresEstimate usa il campo qualitativo basato su segnali indiretti (quanti brand citati, quante recensioni di store rilevati, presenza in articoli di settore).",
    "",
    "BENCHMARK (CONTEXT.md sez. 3 D2):",
    "- <20 store competitor → low (early opportunity)",
    "- 20-100 → medium",
    "- >100 → high",
    "- >200 → saturated",
    "- Durata media ads >30gg → mercato profittevole",
    "- Durata media ads <14gg → nessuno regge → segnale negativo",
    "",
    "DATA CONFIDENCE:",
    "- 'high': fonti che citano numeri o brand verificabili.",
    "- 'medium': segnali indiretti coerenti.",
    "- 'low': segnali deboli/contraddittori. Lo score sarà cappato verso il basso a 30 (non sappiamo abbastanza per condannare).",
    "",
    `OUTPUT: chiama il tool ${TOOL_NAME}. Non rispondere in prosa.`,
  ].join("\n")
}

function serializeSearch(label: string, search: SearchResult): string {
  const lines = [`=== ${label} ===`]
  if (search.findings.length === 0) {
    lines.push("(nessun finding rilevante)")
  } else {
    for (const f of search.findings) {
      lines.push(`- [${f.confidence}] ${f.claim} (fonte: ${f.source})`)
    }
  }
  if (search.notFound.length > 0) {
    lines.push("Aspetti non trovati:")
    for (const nf of search.notFound) lines.push(`  · ${nf}`)
  }
  return lines.join("\n")
}

function buildUserPrompt(
  input: AnalysisInput,
  searches: SearchResult[],
): string {
  const lines: string[] = ["PRODOTTO:"]
  lines.push(`- Nome: ${input.productName}`)
  lines.push(`- Descrizione: ${input.productDescription ?? "(non fornita)"}`)
  lines.push(`- Mercato target: ${input.userMarket}`)
  lines.push(`- Canale utente: ${input.userChannel}`)
  lines.push("")
  lines.push("DATI DI RICERCA RACCOLTI:")
  for (let i = 0; i < searches.length; i++) {
    const s = searches[i]
    if (s === undefined) continue
    lines.push(serializeSearch(`Search ${i + 1}`, s))
    lines.push("")
  }
  lines.push(`Analizza, struttura via ${TOOL_NAME}.`)
  return lines.join("\n")
}

export interface SaturationScoreResult {
  score: number
  additionalWarnings: string[]
}

/**
 * Score deterministico per saturation (0-100).
 *
 * Componenti:
 * - competingStoresEstimate base: low→85, medium→60, high→40, saturated→20, unknown→50.
 * - dominantBrandsPresent: true→-15, false→+5, "unknown"→0.
 * - marketEntryWindow: open→+10, narrowing→0, closed→-15, unknown→0.
 * - avgAdRuntimeDays observed: >30→+10, <14→-10.
 *
 * Floor cap: dataConfidence === 'low' → score >= 30 (non condanniamo
 * un mercato senza evidenze sufficienti).
 */
export function computeSaturationScore(
  data: SaturationData,
  dataConfidence: "high" | "medium" | "low",
): SaturationScoreResult {
  const additionalWarnings: string[] = []

  let score: number
  switch (data.competingStoresEstimate) {
    case "low":
      score = 85
      break
    case "medium":
      score = 60
      break
    case "high":
      score = 40
      break
    case "saturated":
      score = 20
      break
    default:
      score = 50
  }

  if (data.dominantBrandsPresent === true) score -= 15
  else if (data.dominantBrandsPresent === false) score += 5

  switch (data.marketEntryWindow) {
    case "open":
      score += 10
      break
    case "closed":
      score -= 15
      break
    default:
      break
  }

  if (data.avgAdRuntimeDays.type === "observed") {
    if (data.avgAdRuntimeDays.value > 30) score += 10
    else if (data.avgAdRuntimeDays.value < 14) score -= 10
  }

  let finalScore = Math.max(0, Math.min(100, score))
  if (dataConfidence === "low" && finalScore < 30) {
    finalScore = 30
    additionalWarnings.push(
      "Score saturation floor 30: dataConfidence 'low', non abbiamo evidenze sufficienti per condannare il mercato.",
    )
  }

  return { score: Math.round(finalScore), additionalWarnings }
}

function makeFallbackOutput(reason: string): WorkerOutput<SaturationData> {
  return {
    score: 50,
    data: {
      activeAdsCount: { type: "unknown", reason },
      avgAdRuntimeDays: { type: "unknown", reason },
      competingStoresEstimate: "unknown",
      dominantBrandsPresent: "unknown",
      dominantBrandsList: [],
      marketEntryWindow: "unknown",
      sourcesConsulted: [],
    },
    evidence: [],
    warnings: [`Worker saturation fallito o degraded: ${reason}`],
    dataAvailable: false,
    dataConfidence: "unknown",
  }
}

export interface RunSaturationWorkerResult {
  output: WorkerOutput<SaturationData>
  costEur: number
}

export async function runSaturationWorker(
  input: AnalysisInput,
): Promise<RunSaturationWorkerResult> {
  const start = Date.now()
  logJson({
    event: "worker_saturation_start",
    productName: input.productName,
  })
  try {
    return await withTimeout(
      (signal) => runSaturationWorkerInner(input, start, signal),
      TIMEOUT_MS,
      "saturation_worker",
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logJson({
      event: "worker_saturation_error",
      productName: input.productName,
      error: message,
      durationMs: Date.now() - start,
    })
    return { output: makeFallbackOutput(message), costEur: 0 }
  }
}

async function runSaturationWorkerInner(
  input: AnalysisInput,
  start: number,
  signal: AbortSignal,
): Promise<RunSaturationWorkerResult> {
  let totalSearchCost = 0

  const adsResult = await fetchMetaAds({
    productName: input.productName,
    market: input.userMarket,
    maxUses: SEARCH_MAX_USES,
    ttlDays: SEARCH_TTL_DAYS,
    signal,
  })
  totalSearchCost += adsResult.costEur
  const searches: SearchResult[] = [adsResult]

  if (adsResult.findings.length < SECOND_SEARCH_THRESHOLD) {
    logJson({
      event: "worker_saturation_second_search",
      reason: "first_search_thin",
      firstFindings: adsResult.findings.length,
    })
    const storesResult = await fetchShopifyStores({
      productName: input.productName,
      maxUses: SEARCH_MAX_USES,
      ttlDays: SEARCH_TTL_DAYS,
      signal,
    })
    totalSearchCost += storesResult.costEur
    searches.push(storesResult)
  } else {
    logJson({
      event: "worker_saturation_second_search_skipped",
      firstFindings: adsResult.findings.length,
    })
  }

  const result = await callClaude({
    model: "sonnet-4-5",
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(input, searches),
    tools: [REPORT_SATURATION_TOOL],
    toolChoice: { type: "tool", name: TOOL_NAME },
    maxTokens: 1800,
    signal,
  })
  const reasoningCost = result.usage.costEur

  for (const block of result.content) {
    if (block.type !== "tool_use") continue
    if (block.name !== TOOL_NAME) continue
    const parsed = SaturationToolInputSchema.safeParse(block.input)
    if (!parsed.success) {
      logJson({
        event: "worker_saturation_invalid_tool_input",
        productName: input.productName,
        errors: parsed.error.flatten(),
      })
      return {
        output: makeFallbackOutput("tool input validation failed"),
        costEur: totalSearchCost + reasoningCost,
      }
    }
    const { score, additionalWarnings } = computeSaturationScore(
      parsed.data.data,
      parsed.data.dataConfidence,
    )
    const output: WorkerOutput<SaturationData> = {
      score,
      data: parsed.data.data,
      evidence: parsed.data.evidence,
      warnings: [...parsed.data.warnings, ...additionalWarnings],
      dataAvailable: true,
      dataConfidence: parsed.data.dataConfidence,
    }
    logJson({
      event: "worker_saturation_done",
      productName: input.productName,
      score,
      dataConfidence: output.dataConfidence,
      searchCount: searches.length,
      searchCostEur: totalSearchCost,
      reasoningCostEur: reasoningCost,
      durationMs: Date.now() - start,
    })
    return { output, costEur: totalSearchCost + reasoningCost }
  }

  logJson({
    event: "worker_saturation_no_tool_call",
    productName: input.productName,
    costEur: totalSearchCost + reasoningCost,
  })
  return {
    output: makeFallbackOutput("model did not call report_saturation"),
    costEur: totalSearchCost + reasoningCost,
  }
}
