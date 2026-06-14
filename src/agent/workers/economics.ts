// Worker D3 — Economia unitaria (CONTEXT.md sez. 3 D3, peso 30%, più pesante).
//
// Mostly logica + benchmark; LLM serve solo per:
// - Stima COGS se non fornito (1 search call con maxUses=2).
// - Classificazione categoria (always required, decide i benchmark).
//
// Tutto il resto (retail, margine, CPM, CPA, ROAS, profittabilità) è
// calcolato in TypeScript dai benchmark di src/benchmarks.
//
// VETO INTRINSECO: il worker stesso applica cap su grossMarginPct senza
// aspettare l'aggregator (CONTEXT.md sez. 3 aggregator veto).

import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { callClaude } from "@/lib/anthropic"
import { withTimeout, USD_EUR } from "@/lib/utils"
import { searchWeb } from "@/data-sources/web-search"
import { QuantitativeEstimateSchema } from "@/agent/schemas"
import {
  lookupCpmUsd,
  lookupCpaTiktokUsd,
  lookupCvr,
  userChannelToCpmChannel,
} from "@/benchmarks/cpm-cpc"
import { lookupReturnRate } from "@/benchmarks/return-rates"
import {
  GROSS_MARGIN_VETO_RED,
  GROSS_MARGIN_VETO_YELLOW,
} from "@/benchmarks/margin-thresholds"
import type {
  AnalysisInput,
  EconomicsData,
  QuantitativeEstimate,
  SearchResult,
  WorkerOutput,
} from "@/agent/types"

const TIMEOUT_MS = 35_000
const TOOL_NAME = "report_economics"
const SEARCH_MAX_USES = 2
const RETAIL_MARKUP_DEFAULT = 4
const MIN_CONVERSIONS_FOR_PROFITABILITY = 30

const REPORT_ECONOMICS_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Riporta categoryClassification e (se richiesto) estimatedCogs. Tutti gli altri campi economics sono calcolati dal sistema.",
  input_schema: {
    type: "object",
    properties: {
      data: {
        type: "object",
        properties: {
          estimatedCogs: {
            description:
              "Stima COGS in EUR. Da fornire SOLO se richiesto esplicitamente nel prompt (cioè quando l'utente non l'ha fornito). Usa estimated_range con confidence o unknown — mai numero observed senza fonte esplicita.",
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
          categoryClassification: {
            type: "string",
            description:
              "Categoria del prodotto in formato slug snake_case usato dai benchmark: tra retail, beauty, health_wellness, pets, home, lifestyle, fashion, tech, fitness, oppure default se nessuna combacia chiaramente.",
          },
        },
        required: ["categoryClassification"],
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

const EconomicsLLMDataSchema = z.object({
  estimatedCogs: QuantitativeEstimateSchema.optional(),
  categoryClassification: z.string().min(1),
})

const EconomicsToolInputSchema = z.object({
  data: EconomicsLLMDataSchema,
  evidence: z.array(z.string()).min(3).max(5),
  warnings: z.array(z.string()),
  dataConfidence: z.enum(["high", "medium", "low"]),
})

function logJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

function buildSystemPrompt(needsCogsEstimate: boolean): string {
  const lines = [
    "Sei l'analista che valuta la dimensione \"Economia unitaria\" per un prodotto ecommerce.",
    "",
    "IL TUO COMPITO È LIMITATO. Devi produrre:",
    "1. categoryClassification: una sola categoria slug snake_case scelta tra:",
    "   retail, beauty, health_wellness, pets, home, lifestyle, fashion, tech, fitness, default",
    "   (default solo se nessuna combacia chiaramente).",
  ]
  if (needsCogsEstimate) {
    lines.push(
      "2. estimatedCogs: l'utente NON ha fornito il COGS. Stimalo basandoti su fornitori tipici (AliExpress, Alibaba) per prodotti di questa natura. Usa estimated_range con confidence e rationale, oppure unknown se non hai segnali.",
    )
    lines.push("")
    lines.push("IMPORTANTE — fattore di sicurezza COGS:")
    lines.push(
      "I prezzi visibili su AliExpress, Alibaba, e marketplace simili sono spesso prezzi 'civetta' o B2C mascherato, non riflettono il COGS reale per un dropshipper che ordina quantità basse. Devi:",
    )
    lines.push("")
    lines.push("1. Trovare il prezzo wholesale apparente dalle fonti")
    lines.push(
      "2. Applicare un fattore di sicurezza del +25% per coprire costi reali non visibili: shipping fornitore→dropshipper, packaging, fee piattaforma, varianza qualità per ordini piccoli (MOQ 50-100 pezzi).",
    )
    lines.push(
      "3. La tua estimatedCogs finale deve essere il prezzo wholesale apparente moltiplicato per 1.25.",
    )
    lines.push("")
    lines.push(
      "Esempio: se trovi 'AliExpress 4€/pz' come fonte, la tua estimatedCogs non è 4€ ma 5€ (4 × 1.25). Documenta il calcolo nel rationale del QuantitativeEstimate.",
    )
    lines.push("")
    lines.push(
      "Questo fattore è asimmetrico per design: preferiamo sottostimare il margine (utente vede meno potenziale ma non viene ingannato) piuttosto che sovrastimare (utente lancia un test e perde soldi).",
    )
  } else {
    lines.push(
      "2. estimatedCogs: l'utente HA fornito il COGS. NON è di tua competenza, OMETTI il campo nell'output.",
    )
  }
  lines.push("")
  lines.push(
    "Tutto il resto (prezzo retail, margine, CPM/CPA stimati, ROAS, profittabilità) viene calcolato dal sistema dai benchmark di settore. NON tentare di calcolarli — non hai accesso ai benchmark interni.",
  )
  lines.push("")
  lines.push("REGOLE ANTI-ALLUCINAZIONE (CONTEXT.md sez. 6.4):")
  lines.push(
    "- Mai inventare numeri precisi. Stime sempre come estimated_range con motivazione, oppure unknown.",
  )
  lines.push("")
  lines.push("DATA CONFIDENCE:")
  lines.push("- 'high': prodotto chiaro, categoria ovvia, COGS (se richiesto) ricavato da segnali multipli concordanti.")
  lines.push("- 'medium': categoria deducibile ma non univoca; COGS in range ampio.")
  lines.push("- 'low': prodotto generico, categoria ambigua, COGS molto incerto.")
  lines.push("")
  lines.push(`OUTPUT: chiama il tool ${TOOL_NAME}. Non rispondere in prosa.`)
  return lines.join("\n")
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
  return lines.join("\n")
}

function buildUserPrompt(
  input: AnalysisInput,
  cogsSearch: SearchResult | null,
): string {
  const lines: string[] = ["PRODOTTO:"]
  lines.push(`- Nome: ${input.productName}`)
  lines.push(`- Descrizione: ${input.productDescription ?? "(non fornita)"}`)
  lines.push(`- URL: ${input.productUrl ?? "(non fornito)"}`)
  if (input.productCogs !== undefined) {
    lines.push(`- COGS fornito dall'utente: ${input.productCogs}€`)
  } else {
    lines.push("- COGS: NON fornito dall'utente — devi stimarlo")
  }
  lines.push("")
  if (cogsSearch !== null) {
    lines.push("DATI DI RICERCA SUL COGS:")
    lines.push(serializeSearch("Search wholesale prices", cogsSearch))
    lines.push("")
  }
  lines.push(`Analizza, struttura via ${TOOL_NAME}.`)
  return lines.join("\n")
}

interface ResolvedCogs {
  cogsEur: number
  estimatedCogs: QuantitativeEstimate
  cogsConfidence: "high" | "medium" | "low" | "unknown"
}

function midOfRange(min: number, max: number): number {
  return (min + max) / 2
}

function resolveCogs(
  input: AnalysisInput,
  llmCogs: QuantitativeEstimate | undefined,
): ResolvedCogs | null {
  if (input.productCogs !== undefined) {
    return {
      cogsEur: input.productCogs,
      estimatedCogs: {
        type: "observed",
        value: input.productCogs,
        source: "user_input",
      },
      cogsConfidence: "high",
    }
  }
  if (llmCogs === undefined) return null
  if (llmCogs.type === "observed") {
    return {
      cogsEur: llmCogs.value,
      estimatedCogs: llmCogs,
      cogsConfidence: "high",
    }
  }
  if (llmCogs.type === "estimated_range") {
    return {
      cogsEur: midOfRange(llmCogs.min, llmCogs.max),
      estimatedCogs: llmCogs,
      cogsConfidence: llmCogs.confidence,
    }
  }
  return {
    cogsEur: 0,
    estimatedCogs: llmCogs,
    cogsConfidence: "unknown",
  }
}

interface ComputedEconomics {
  data: EconomicsData
  netMarginAfterAds: number
}

function computeEconomicsFromCogs(
  input: AnalysisInput,
  cogsEur: number,
  estimatedCogs: QuantitativeEstimate,
  category: string,
): ComputedEconomics {
  const suggestedRetailPrice =
    Math.round(cogsEur * RETAIL_MARKUP_DEFAULT * 100) / 100
  const grossMarginPct =
    suggestedRetailPrice > 0
      ? (suggestedRetailPrice - cogsEur) / suggestedRetailPrice
      : 0

  const cpmChannel = userChannelToCpmChannel(input.userChannel)
  // Se canale è amazon_fba (cpmChannel null), usiamo benchmark Meta IT come
  // proxy conservativo. Phase 4: sostituire con benchmark Amazon ads dedicati.
  const effectiveChannel = cpmChannel ?? "meta"
  const cpmUsd = lookupCpmUsd({
    channel: effectiveChannel,
    category,
    market: input.userMarket,
  })
  const estimatedCpm = cpmUsd * USD_EUR

  // CPA: lookup TikTok per categoria; per Meta deriviamo da CPM/CVR.
  const cvr = lookupCvr(effectiveChannel)
  const estimatedCpa =
    effectiveChannel === "tiktok"
      ? lookupCpaTiktokUsd(category) * USD_EUR
      : // Approssimazione Meta: CPC ~= CPM/1000 / CTR(2%) → CPA ~= CPC/CVR.
        // Stima conservativa: CPM_eur / (1000 × 0.02 × cvr).
        estimatedCpm / (1000 * 0.02 * cvr)

  const netMarginAfterAds =
    grossMarginPct -
    (suggestedRetailPrice > 0 ? estimatedCpa / suggestedRetailPrice : 1)
  const breakevenRoas =
    netMarginAfterAds > 0 ? 1 / netMarginAfterAds : Infinity
  const profitableAtUserBudget =
    input.userBudget >= estimatedCpa * MIN_CONVERSIONS_FOR_PROFITABILITY
  const expectedReturnRate = lookupReturnRate(category)

  return {
    data: {
      estimatedCogs,
      suggestedRetailPrice,
      grossMarginPct,
      estimatedCpm,
      estimatedCpa,
      breakevenRoas: Number.isFinite(breakevenRoas) ? breakevenRoas : 999,
      profitableAtUserBudget,
      expectedReturnRate,
      categoryClassification: category,
    },
    netMarginAfterAds,
  }
}

export interface EconomicsScoreResult {
  score: number
  additionalWarnings: string[]
}

/**
 * Score deterministico per economics (0-100).
 *
 * Componenti:
 * - grossMarginPct × 0.50 — passthrough lineare 0-100% → 0-100.
 * - profitableAtUserBudget × 0.20 — true→+20 dal centro 50, false→-20.
 * - breakevenRoas × 0.15 — <2→+15, 2-3→+5, 3-4→0, >4→-15 (sopra il centro 50).
 * - expectedReturnRate × 0.15 — <10%→+10, 10-20%→0, >20%→-15.
 *
 * VETO INTRINSECO al worker (CONTEXT.md sez. 3 aggregator veto):
 * - grossMarginPct < 0.30 → score max 30.
 * - grossMarginPct < 0.50 → score max 54.
 */
export function computeEconomicsScore(
  data: EconomicsData,
): EconomicsScoreResult {
  const additionalWarnings: string[] = []

  const marginComponent = Math.max(0, Math.min(100, data.grossMarginPct * 100))
  const profitComponent = data.profitableAtUserBudget ? 70 : 30

  let roasComponent: number
  if (data.breakevenRoas < 2) roasComponent = 65
  else if (data.breakevenRoas < 3) roasComponent = 55
  else if (data.breakevenRoas < 4) roasComponent = 50
  else roasComponent = 35

  let returnComponent: number
  if (data.expectedReturnRate < 0.10) returnComponent = 60
  else if (data.expectedReturnRate < 0.20) returnComponent = 50
  else returnComponent = 35

  const weighted =
    marginComponent * 0.5 +
    profitComponent * 0.2 +
    roasComponent * 0.15 +
    returnComponent * 0.15

  let finalScore = Math.max(0, Math.min(100, weighted))

  if (data.grossMarginPct < GROSS_MARGIN_VETO_RED) {
    if (finalScore > 30) {
      additionalWarnings.push(
        `Score economics cappato a 30: margine lordo ${(data.grossMarginPct * 100).toFixed(1)}% sotto la soglia veto rosso del 30%.`,
      )
    }
    finalScore = Math.min(finalScore, 30)
  } else if (data.grossMarginPct < GROSS_MARGIN_VETO_YELLOW) {
    if (finalScore > 54) {
      additionalWarnings.push(
        `Score economics cappato a 54: margine lordo ${(data.grossMarginPct * 100).toFixed(1)}% sotto la soglia veto giallo del 50%.`,
      )
    }
    finalScore = Math.min(finalScore, 54)
  }

  return { score: Math.round(finalScore), additionalWarnings }
}

function makeFallbackOutput(reason: string): WorkerOutput<EconomicsData> {
  return {
    score: 50,
    data: {
      estimatedCogs: { type: "unknown", reason },
      // Valori veto-safe nel fallback per non far scattare regole aggregator
      // su placeholder. L'aggregator dovrebbe comunque saltare il veto quando
      // dataAvailable=false (defense in depth).
      suggestedRetailPrice: 0,
      grossMarginPct: 0.65,
      estimatedCpm: 0,
      estimatedCpa: 0,
      breakevenRoas: 0,
      profitableAtUserBudget: false,
      expectedReturnRate: 0.10,
      categoryClassification: "default",
    },
    evidence: [],
    warnings: [`Worker economics fallito o degraded: ${reason}`],
    dataAvailable: false,
    dataConfidence: "unknown",
  }
}

export interface RunEconomicsWorkerResult {
  output: WorkerOutput<EconomicsData>
  costEur: number
}

export async function runEconomicsWorker(
  input: AnalysisInput,
): Promise<RunEconomicsWorkerResult> {
  const start = Date.now()
  logJson({
    event: "worker_economics_start",
    productName: input.productName,
    cogsProvided: input.productCogs !== undefined,
  })
  try {
    return await withTimeout(
      (signal) => runEconomicsWorkerInner(input, start, signal),
      TIMEOUT_MS,
      "economics_worker",
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logJson({
      event: "worker_economics_error",
      productName: input.productName,
      error: message,
      durationMs: Date.now() - start,
    })
    return { output: makeFallbackOutput(message), costEur: 0 }
  }
}

async function runEconomicsWorkerInner(
  input: AnalysisInput,
  start: number,
  signal: AbortSignal,
): Promise<RunEconomicsWorkerResult> {
  let totalSearchCost = 0
  let cogsSearch: SearchResult | null = null
  if (input.productCogs === undefined) {
    cogsSearch = await searchWeb({
      query: `${input.productName} aliexpress alibaba wholesale price 2026`,
      contextHint: "economics_cogs_estimation",
      maxUses: SEARCH_MAX_USES,
      signal,
    })
    totalSearchCost += cogsSearch.costEur
  }

  const result = await callClaude({
    model: "sonnet-4-5",
    system: buildSystemPrompt(input.productCogs === undefined),
    prompt: buildUserPrompt(input, cogsSearch),
    tools: [REPORT_ECONOMICS_TOOL],
    toolChoice: { type: "tool", name: TOOL_NAME },
    maxTokens: 1500,
    signal,
  })
  const reasoningCost = result.usage.costEur

  for (const block of result.content) {
    if (block.type !== "tool_use") continue
    if (block.name !== TOOL_NAME) continue
    const parsed = EconomicsToolInputSchema.safeParse(block.input)
    if (!parsed.success) {
      logJson({
        event: "worker_economics_invalid_tool_input",
        productName: input.productName,
        errors: parsed.error.flatten(),
      })
      return {
        output: makeFallbackOutput("tool input validation failed"),
        costEur: totalSearchCost + reasoningCost,
      }
    }

    const resolved = resolveCogs(input, parsed.data.data.estimatedCogs)
    if (resolved === null) {
      logJson({
        event: "worker_economics_no_cogs",
        productName: input.productName,
      })
      return {
        output: makeFallbackOutput("no COGS available (user input or LLM)"),
        costEur: totalSearchCost + reasoningCost,
      }
    }

    const computed = computeEconomicsFromCogs(
      input,
      resolved.cogsEur,
      resolved.estimatedCogs,
      parsed.data.data.categoryClassification,
    )
    const { score, additionalWarnings } = computeEconomicsScore(computed.data)

    // Confidence finale: minimo tra LLM dataConfidence e cogsConfidence.
    const confidenceRank: Record<string, number> = {
      unknown: 0,
      low: 1,
      medium: 2,
      high: 3,
    }
    const llmRank = confidenceRank[parsed.data.dataConfidence] ?? 0
    const cogsRank = confidenceRank[resolved.cogsConfidence] ?? 0
    const minRank = Math.min(llmRank, cogsRank)
    let finalConfidence: "high" | "medium" | "low" =
      minRank >= 3 ? "high" : minRank === 2 ? "medium" : "low"

    // Bias known: la stima COGS via web_search ha errore asimmetrico.
    // Anche se LLM e cogsConfidence sono entrambi "high", la precisione
    // dei calcoli derivati (margine, ROAS, profittabilità) dipende dalla
    // precisione del COGS. Capa la confidence finale a "medium" e segnala
    // all'utente che il COGS è stimato.
    // Detection robusta: deriva dalla discriminated union risolta, non
    // dall'AnalysisInput originale (più robusto se in futuro la pipeline
    // cambia il flusso input → resolveCogs).
    const eCogs = computed.data.estimatedCogs
    const cogsWasEstimated = !(
      eCogs.type === "observed" && eCogs.source === "user_input"
    )
    const extraWarnings: string[] = []
    if (cogsWasEstimated && finalConfidence === "high") {
      finalConfidence = "medium"
      extraWarnings.push(
        "COGS stimato dal sistema, non fornito dall'utente. Per calcoli precisi conferma il COGS reale con il tuo fornitore.",
      )
    }

    const output: WorkerOutput<EconomicsData> = {
      score,
      data: computed.data,
      evidence: parsed.data.evidence,
      warnings: [
        ...parsed.data.warnings,
        ...additionalWarnings,
        ...extraWarnings,
      ],
      dataAvailable: true,
      dataConfidence: finalConfidence,
    }
    logJson({
      event: "worker_economics_done",
      productName: input.productName,
      score,
      grossMarginPct: computed.data.grossMarginPct,
      profitableAtUserBudget: computed.data.profitableAtUserBudget,
      breakevenRoas: computed.data.breakevenRoas,
      dataConfidence: finalConfidence,
      searchCostEur: totalSearchCost,
      reasoningCostEur: reasoningCost,
      durationMs: Date.now() - start,
    })
    return { output, costEur: totalSearchCost + reasoningCost }
  }

  logJson({
    event: "worker_economics_no_tool_call",
    productName: input.productName,
    costEur: totalSearchCost + reasoningCost,
  })
  return {
    output: makeFallbackOutput("model did not call report_economics"),
    costEur: totalSearchCost + reasoningCost,
  }
}
