// Worker D1 — Domanda di mercato (CONTEXT.md sez. 3 D1, peso 20%).
//
// Pattern:
// 1. fetchGoogleTrends (Layer 1 stub → searchWeb) raccoglie trend/volumi.
// 2. Se findings rilevanti < SECOND_SEARCH_THRESHOLD, secondo search dedicato
//    a TikTok hashtag momentum (segnale social).
// 3. Sonnet 4.5 con tool use forzato struttura DemandData.
// 4. computeDemandScore deterministico calcola lo score.

import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { callClaude } from "@/lib/anthropic"
import { withTimeout } from "@/lib/utils"
import { fetchGoogleTrends } from "@/data-sources/google-trends"
import { searchWeb } from "@/data-sources/web-search"
import { DemandDataSchema } from "@/agent/schemas"
import type {
  AnalysisInput,
  DemandData,
  SearchResult,
  WorkerOutput,
} from "@/agent/types"

// Deviazione da CONTEXT.md sez. 5: misurato empiricamente che demand richiede
// 125-130s con max_uses=4 e CLAUDE_MAX_CONCURRENT=4 (web_search server-side
// + reasoning Sonnet + queue su semaforo). 150s dà buffer p99.
const TIMEOUT_MS = 150_000
const TOOL_NAME = "report_demand"
const SEARCH_MAX_USES = 4
const SECOND_SEARCH_THRESHOLD = 5
// TTL cache più stretto: domanda TikTok-emergente cambia in 24-72h.
const SEARCH_TTL_DAYS = 2

const REPORT_DEMAND_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Riporta il risultato strutturato della valutazione 'Domanda di mercato'. Da chiamare come unico output dopo aver analizzato le fonti raccolte.",
  input_schema: {
    type: "object",
    properties: {
      data: {
        type: "object",
        properties: {
          trendDirection: {
            type: "string",
            enum: ["rising", "stable", "declining", "unknown"],
            description:
              "Direzione del trend di interesse a 90 giorni dalle fonti consultate.",
          },
          monthlySearchesEstimate: {
            description:
              "Volume mensile stimato. Usa 'observed' SOLO se la fonte cita un numero esplicito (Ahrefs, Semrush, Google Keyword Planner). Altrimenti 'estimated_range' con confidence appropriata o 'unknown'.",
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
                  confidence: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                  },
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
          relatedRisingQueries: {
            type: "array",
            items: { type: "string" },
            description:
              "Query correlate in crescita (es. 'massaggiatore collo cervicale 2026').",
          },
          socialMomentum: {
            type: "string",
            enum: ["low", "medium", "high", "unknown"],
            description:
              "Momentum sui social (TikTok hashtag views, virality). Unknown se non hai segnali.",
          },
          problemAwarenessScore: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description:
              "Quanto il problema/bisogno risolto dal prodotto è già conosciuto dal pubblico (0-100). Giudizio qualitativo.",
          },
          sourcesConsulted: {
            type: "array",
            items: { type: "string" },
            description: "Domini/URL/articoli consultati (max 6).",
          },
        },
        required: [
          "trendDirection",
          "monthlySearchesEstimate",
          "relatedRisingQueries",
          "socialMomentum",
          "problemAwarenessScore",
          "sourcesConsulted",
        ],
      },
      evidence: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" },
        description:
          "3-5 stringhe in italiano che spiegano il ragionamento e citano le fonti.",
      },
      warnings: {
        type: "array",
        items: { type: "string" },
        description:
          "Red flag concreti: trend in calo del 30%+, fonti datate >2 anni, segnale ambiguo.",
      },
      dataConfidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description:
          "high: fonti autorevoli con numeri verificabili. medium: trend chiari ma volumi stimati. low: solo segnali deboli o contraddittori.",
      },
    },
    required: ["data", "evidence", "warnings", "dataConfidence"],
  },
}

const DemandLLMDataSchema = DemandDataSchema

const DemandToolInputSchema = z.object({
  data: DemandLLMDataSchema,
  evidence: z.array(z.string()).min(3).max(5),
  warnings: z.array(z.string()),
  dataConfidence: z.enum(["high", "medium", "low"]),
})

function logJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

function buildSystemPrompt(): string {
  return [
    "Sei l'analista che valuta la dimensione \"Domanda di mercato\" per un prodotto ecommerce.",
    "Hai ricevuto risultati di ricerca pre-fatti su Google Trends e (opzionalmente) TikTok hashtag.",
    "",
    "REGOLE ANTI-ALLUCINAZIONE (CONTEXT.md sez. 6.4) — applicare con DISCIPLINA:",
    "- I volumi di ricerca da web_search sono difficili da pinpointare con precisione.",
    "- Se non hai una fonte autorevole (Google Keyword Planner, Ahrefs, Semrush) che cita un numero specifico, usa estimated_range con confidence appropriata o unknown.",
    "- 'observed' SOLO se la fonte cita ESPLICITAMENTE un numero verificabile.",
    "- Forbice ragionevole con motivazione > numero plausibile inventato.",
    "",
    "BENCHMARK INTERPRETATIVI (CONTEXT.md sez. 3 D1):",
    "- <1.000 ricerche/mese in IT = basso",
    "- 1.000-10.000 = medio",
    "- >10.000 = alto",
    "- Trend in calo del 30% YoY = penalità forte (warning obbligatorio).",
    "",
    "DATA CONFIDENCE:",
    "- 'high': fonti autorevoli, numeri verificabili coerenti.",
    "- 'medium': trend chiari, volumi solo stimati.",
    "- 'low': segnali deboli o contraddittori. Lo score sarà cappato.",
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
  lines.push(
    `- Descrizione: ${input.productDescription ?? "(non fornita)"}`,
  )
  lines.push(`- Mercato target: ${input.userMarket}`)
  lines.push("")
  lines.push("DATI DI RICERCA RACCOLTI:")
  for (let i = 0; i < searches.length; i++) {
    const s = searches[i]
    if (s === undefined) continue
    lines.push(serializeSearch(`Search ${i + 1}`, s))
    lines.push("")
  }
  lines.push(
    `Analizza, struttura via ${TOOL_NAME}. Rispetta le regole anti-allucinazione.`,
  )
  return lines.join("\n")
}

function isQuantitativeWithValue(
  q: DemandData["monthlySearchesEstimate"],
): { value: number; source: "observed" | "estimated" } | null {
  if (q.type === "observed") return { value: q.value, source: "observed" }
  if (q.type === "estimated_range") {
    return { value: (q.min + q.max) / 2, source: "estimated" }
  }
  return null
}

export interface DemandScoreResult {
  score: number
  additionalWarnings: string[]
}

/**
 * Score deterministico per demand (0-100).
 *
 * Componenti pesati:
 * - monthlySearchesEstimate × 0.50 — 25/55/80 secondo benchmark <1k / 1-10k / >10k.
 * - trendDirection × 0.20 — rising +10, declining -15, stable/unknown 0 (centrato a 50).
 * - socialMomentum × 0.15 — high +5, medium 0, low -5, unknown 0 (centrato a 50).
 * - problemAwarenessScore × 0.15 — passthrough lineare.
 *
 * Cap superiore: dataConfidence === 'low' → max 70.
 */
export function computeDemandScore(
  data: DemandData,
  dataConfidence: "high" | "medium" | "low",
): DemandScoreResult {
  const additionalWarnings: string[] = []

  const q = isQuantitativeWithValue(data.monthlySearchesEstimate)
  let monthlyComponent: number
  if (q === null) {
    monthlyComponent = 50 // unknown → neutro
  } else if (q.value > 10_000) monthlyComponent = 80
  else if (q.value >= 1_000) monthlyComponent = 55
  else monthlyComponent = 25

  const trendComponent =
    data.trendDirection === "rising"
      ? 60
      : data.trendDirection === "declining"
        ? 35
        : 50
  const socialComponent =
    data.socialMomentum === "high"
      ? 55
      : data.socialMomentum === "low"
        ? 45
        : 50
  const awarenessComponent = data.problemAwarenessScore

  const weighted =
    monthlyComponent * 0.5 +
    trendComponent * 0.2 +
    socialComponent * 0.15 +
    awarenessComponent * 0.15

  let finalScore = Math.max(0, Math.min(100, weighted))
  if (dataConfidence === "low") {
    if (finalScore > 70) {
      finalScore = 70
      additionalWarnings.push(
        "Score demand cappato a 70: dataConfidence 'low', non abbiamo evidenze sufficienti per uno score più alto.",
      )
    }
  }

  return { score: Math.round(finalScore), additionalWarnings }
}

function makeFallbackOutput(reason: string): WorkerOutput<DemandData> {
  return {
    score: 50,
    data: {
      trendDirection: "unknown",
      monthlySearchesEstimate: { type: "unknown", reason },
      relatedRisingQueries: [],
      socialMomentum: "unknown",
      problemAwarenessScore: 50,
      sourcesConsulted: [],
    },
    evidence: [],
    warnings: [`Worker demand fallito o degraded: ${reason}`],
    dataAvailable: false,
    dataConfidence: "unknown",
  }
}

export interface RunDemandWorkerResult {
  output: WorkerOutput<DemandData>
  costEur: number
}

export async function runDemandWorker(
  input: AnalysisInput,
): Promise<RunDemandWorkerResult> {
  const start = Date.now()
  logJson({ event: "worker_demand_start", productName: input.productName })

  try {
    return await withTimeout(
      (signal) => runDemandWorkerInner(input, start, signal),
      TIMEOUT_MS,
      "demand_worker",
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logJson({
      event: "worker_demand_error",
      productName: input.productName,
      error: message,
      durationMs: Date.now() - start,
    })
    return { output: makeFallbackOutput(message), costEur: 0 }
  }
}

async function runDemandWorkerInner(
  input: AnalysisInput,
  start: number,
  signal: AbortSignal,
): Promise<RunDemandWorkerResult> {
  let totalSearchCost = 0

  const trendsResult = await fetchGoogleTrends({
    productName: input.productName,
    market: input.userMarket,
    maxUses: SEARCH_MAX_USES,
    ttlDays: SEARCH_TTL_DAYS,
    signal,
  })
  totalSearchCost += trendsResult.costEur
  const searches: SearchResult[] = [trendsResult]

  if (trendsResult.findings.length < SECOND_SEARCH_THRESHOLD) {
    logJson({
      event: "worker_demand_second_search",
      reason: "first_search_thin",
      firstFindings: trendsResult.findings.length,
    })
    const socialResult = await searchWeb({
      query: `TikTok hashtag e momentum social per "${input.productName}" 2026: views totali, virality, post recenti`,
      contextHint: "tiktok_momentum_demand",
      maxUses: SEARCH_MAX_USES,
      ttlDays: SEARCH_TTL_DAYS,
      signal,
    })
    totalSearchCost += socialResult.costEur
    searches.push(socialResult)
  } else {
    logJson({
      event: "worker_demand_second_search_skipped",
      firstFindings: trendsResult.findings.length,
    })
  }

  const result = await callClaude({
    model: "sonnet-4-5",
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(input, searches),
    tools: [REPORT_DEMAND_TOOL],
    toolChoice: { type: "tool", name: TOOL_NAME },
    maxTokens: 1800,
    signal,
  })
  const reasoningCost = result.usage.costEur

  for (const block of result.content) {
    if (block.type !== "tool_use") continue
    if (block.name !== TOOL_NAME) continue
    const parsed = DemandToolInputSchema.safeParse(block.input)
    if (!parsed.success) {
      logJson({
        event: "worker_demand_invalid_tool_input",
        productName: input.productName,
        errors: parsed.error.flatten(),
      })
      return {
        output: makeFallbackOutput("tool input validation failed"),
        costEur: totalSearchCost + reasoningCost,
      }
    }
    const { score, additionalWarnings } = computeDemandScore(
      parsed.data.data,
      parsed.data.dataConfidence,
    )
    const output: WorkerOutput<DemandData> = {
      score,
      data: parsed.data.data,
      evidence: parsed.data.evidence,
      warnings: [...parsed.data.warnings, ...additionalWarnings],
      dataAvailable: true,
      dataConfidence: parsed.data.dataConfidence,
    }
    logJson({
      event: "worker_demand_done",
      productName: input.productName,
      score,
      dataConfidence: output.dataConfidence,
      searchCount: searches.length,
      searchCostEur: totalSearchCost,
      reasoningCostEur: reasoningCost,
      durationMs: Date.now() - start,
    })
    return {
      output,
      costEur: totalSearchCost + reasoningCost,
    }
  }

  logJson({
    event: "worker_demand_no_tool_call",
    productName: input.productName,
    costEur: totalSearchCost + reasoningCost,
  })
  return {
    output: makeFallbackOutput("model did not call report_demand"),
    costEur: totalSearchCost + reasoningCost,
  }
}
