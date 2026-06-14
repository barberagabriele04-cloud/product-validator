// Worker D5 — Rischio (CONTEXT.md sez. 3 D5, peso 15%).
//
// Architettura: il worker produce DUE blocchi semanticamente distinti.
// - MarketRisk: return rate, qualità, sicurezza prodotto. Influenza lo SCORE.
// - ComplianceFlag: categoria ristretta, trademark, CE. NON influenza lo
//   score finale — viene esposto come banner separato dal frontend.
//
// Lo score del worker risk riflette ora SOLO il market risk. Il vecchio
// veto a 25 fisso (compliance-driven) è rimosso. Le veto rules economiche
// (margine basso, return rate alto) restano nell'aggregator.

import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { callClaude } from "@/lib/anthropic"
import { withTimeout } from "@/lib/utils"
import { searchWeb } from "@/data-sources/web-search"
import {
  ceComplianceRequiredForCategory,
  getRestrictedPlatforms,
  isRestrictedCategory,
  RESTRICTED_CATEGORIES,
  type RestrictedPlatform,
} from "@/benchmarks/restricted-categories"
import {
  lookupReturnRate,
  RETURN_RATE_VETO_THRESHOLD,
} from "@/benchmarks/return-rates"
import type {
  AnalysisInput,
  ComplianceFlag,
  ComplianceSeverity,
  MarketRiskData,
  RiskData,
  SearchResult,
  TrademarkRisk,
  WorkerOutput,
} from "@/agent/types"

// Deviazione da CONTEXT.md sez. 5: misurato 110-115s con max_uses=2 e
// CLAUDE_MAX_CONCURRENT=4. 90s dà buffer p95.
const TIMEOUT_MS = 90_000
const TOOL_NAME = "report_risk"
const SEARCH_MAX_USES = 2

const REPORT_RISK_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Riporta dati MARKET RISK (return rate, sicurezza, qualità) + dati COMPLIANCE LLM-derivati (trademark + categoryClassification). Il sistema poi calcola in autonomia restrictedCategory, ceComplianceRequired e severity finale.",
  input_schema: {
    type: "object",
    properties: {
      data: {
        type: "object",
        properties: {
          categoryClassification: {
            type: "string",
            description:
              "Categoria slug snake_case usata anche dal worker economics. Tra: retail, beauty, health_wellness, pets, home, lifestyle, fashion, tech, fitness, default. PIÙ categorie sensibili (queste fanno scattare il sistema compliance): weapons, supplements_health_claims, cbd_cannabis, medical_devices, adult, gambling, tobacco_vape, alcoholics, political_ads, financial_services. Scegli quella più precisa.",
          },
          expectedReturnRate: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description:
              "Frazione 0-1 stimata del tasso di reso atteso per la categoria/prodotto. Il sistema poi confronta con il benchmark interno; se il valore LLM e benchmark divergono, vince il benchmark interno (calibrato).",
          },
          productSafetyConcerns: {
            type: "boolean",
            description:
              "true se nelle fonti hai trovato segnalazioni concrete di problemi di sicurezza, recall, malfunzionamenti diffusi.",
          },
          qualityIssuesReported: {
            type: "boolean",
            description:
              "true se nelle fonti hai trovato segnalazioni ricorrenti di qualità scadente, durabilità bassa, materiali difettosi.",
          },
          trademarkRisk: {
            type: "string",
            enum: ["low", "medium", "high", "unknown"],
            description:
              "Rischio violazione marchio/brevetto. 'high' SOLO con evidenza esplicita di brand/patent rilevante nelle fonti. 'medium' se prodotto richiama design o naming di brand noti. 'low' se commodity/generico. 'unknown' se non hai informazioni sufficienti.",
          },
          trademarkDetails: {
            type: ["string", "null"],
            description:
              "Descrizione del rischio trademark se medium/high (es. 'design molto simile a Brand X'). null se low/unknown.",
          },
        },
        required: [
          "categoryClassification",
          "expectedReturnRate",
          "productSafetyConcerns",
          "qualityIssuesReported",
          "trademarkRisk",
          "trademarkDetails",
        ],
      },
      evidence: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" },
        description:
          "3-5 stringhe in italiano. Cita fonti di market risk (recensioni Amazon, articoli sicurezza) e compliance separatamente.",
      },
      warnings: {
        type: "array",
        items: { type: "string" },
        description:
          "Warning concreti non facilmente esprimibili nei campi strutturati (es. 'fornitore con storia di lotti difettosi').",
      },
      dataConfidence: {
        type: "string",
        enum: ["high", "medium", "low"],
      },
    },
    required: ["data", "evidence", "warnings", "dataConfidence"],
  },
}

const RiskLLMDataSchema = z.object({
  categoryClassification: z.string().min(1),
  expectedReturnRate: z.number().min(0).max(1),
  productSafetyConcerns: z.boolean(),
  qualityIssuesReported: z.boolean(),
  trademarkRisk: z.enum(["low", "medium", "high", "unknown"]),
  trademarkDetails: z.string().nullable(),
})

const RiskToolInputSchema = z.object({
  data: RiskLLMDataSchema,
  evidence: z.array(z.string()).min(3).max(5),
  warnings: z.array(z.string()),
  dataConfidence: z.enum(["high", "medium", "low"]),
})

function logJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

function buildSystemPrompt(): string {
  const restrictedSlugs = Array.from(
    new Set([
      ...RESTRICTED_CATEGORIES.meta,
      ...RESTRICTED_CATEGORIES.tiktok,
    ]),
  )
  return [
    "Sei l'analista che valuta la dimensione \"Rischio\" per un prodotto ecommerce.",
    "Il rischio è composto di DUE parti separate:",
    "",
    "1. MARKET RISK (influenza lo score): return rate atteso, qualità prodotto, sicurezza.",
    "2. COMPLIANCE / LEGAL (NON influenza lo score, mostrato come banner separato): categoria ristretta, trademark.",
    "",
    "Hai ricevuto risultati di ricerca su trademark/patent/safety/recall/qualità.",
    "",
    "CATEGORIE RISTRETTE (CONTEXT.md sez. 4) — se il prodotto rientra in una di queste, classifica esattamente con lo slug:",
    `${restrictedSlugs.join(", ")}.`,
    "Altrimenti usa una categoria di settore (retail, beauty, health_wellness, pets, home, lifestyle, fashion, tech, fitness, default).",
    "",
    "REGOLE PER trademarkRisk:",
    "- 'high' SOLO con evidenza esplicita di brand/patent rilevante nelle fonti.",
    "- 'medium' se prodotto richiama design o naming di brand noti senza essere copia diretta.",
    "- 'low' se prodotto è commodity/generico.",
    "- 'unknown' se non hai informazioni sufficienti.",
    "",
    "REGOLE PER expectedReturnRate:",
    "- Stima frazione 0-1 (es. 0.04 = 4%).",
    "- Categoria pets/wellness ~4-6%, fashion ~10%, tech ~12%, beauty ~6%, home ~5%.",
    "- Se hai segnali specifici (recensioni che parlano di resi frequenti), aggiusta verso l'alto.",
    "",
    "REGOLE PER productSafetyConcerns / qualityIssuesReported:",
    "- true SOLO se nelle fonti trovi segnalazioni concrete (recall, articoli, recensioni ricorrenti negative).",
    "- false se le fonti sono pulite o silenti.",
    "- NON inventare problemi se non hai evidenze.",
    "",
    "REGOLE ANTI-ALLUCINAZIONE: mai inventare nomi di brand o numeri di patent. Se incerto → 'unknown'.",
    "",
    "DATA CONFIDENCE:",
    "- 'high': fonti citano direttamente trademark, recall, certificazioni, dati di reso.",
    "- 'medium': segnali indiretti.",
    "- 'low': fonti scarse/contraddittorie.",
    "",
    "NOTA: il sistema calcola DA SOLO i campi `restrictedCategory`, `restrictedPlatforms`, `ceComplianceRequired`, e la `severity` finale. Non includerli nell'output — fornisci solo i 6 campi richiesti dallo schema.",
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
  search: SearchResult,
): string {
  const lines: string[] = ["PRODOTTO:"]
  lines.push(`- Nome: ${input.productName}`)
  lines.push(`- Descrizione: ${input.productDescription ?? "(non fornita)"}`)
  lines.push(`- Canale utente: ${input.userChannel}`)
  lines.push(`- Mercato: ${input.userMarket}`)
  lines.push("")
  lines.push("DATI DI RICERCA RACCOLTI:")
  lines.push(serializeSearch("Search trademark/patent/safety/recall/qualità", search))
  lines.push("")
  lines.push(`Analizza, struttura via ${TOOL_NAME}.`)
  return lines.join("\n")
}

// ─── Logica deterministica: severity, market score ──────────────────────

function computeComplianceSeverity(args: {
  restricted: boolean
  trademarkRisk: TrademarkRisk
  ceRequired: boolean
}): ComplianceSeverity {
  // Critical: prodotto restricted O trademark high
  if (args.restricted) return "critical"
  if (args.trademarkRisk === "high") return "critical"

  // Warning: trademark medium O CE required (informativo)
  if (args.trademarkRisk === "medium") return "warning"
  if (args.ceRequired) return "warning"

  return "none"
}

function platformLabel(p: RestrictedPlatform): string {
  return p === "meta" ? "Meta" : "TikTok"
}

function buildReasonsList(args: {
  restricted: boolean
  restrictedPlatforms: RestrictedPlatform[]
  trademarkRisk: TrademarkRisk
  trademarkDetails: string | null
  ceRequired: boolean
  category: string
}): string[] {
  const reasons: string[] = []
  if (args.restricted) {
    const platforms = args.restrictedPlatforms.map(platformLabel).join(" / ")
    reasons.push(
      `Categoria '${args.category}' ristretta su ${platforms}: l'advertising su questi canali viene bloccato dalle policy.`,
    )
  }
  if (args.trademarkRisk === "high") {
    const detail =
      args.trademarkDetails !== null && args.trademarkDetails !== ""
        ? ` Dettaglio: ${args.trademarkDetails}`
        : ""
    reasons.push(`Rischio trademark elevato.${detail}`)
  } else if (args.trademarkRisk === "medium") {
    const detail =
      args.trademarkDetails !== null && args.trademarkDetails !== ""
        ? ` Dettaglio: ${args.trademarkDetails}`
        : ""
    reasons.push(`Rischio trademark moderato.${detail}`)
  }
  if (args.ceRequired) {
    reasons.push(
      `Marcatura CE richiesta per import/vendita EU (categoria '${args.category}'). Verifica documentazione fornitore.`,
    )
  }
  return reasons
}

/**
 * Score market risk (0-100) — riflette SOLO il rischio di mercato, non il
 * compliance. Baseline 75 (neutro-positivo); aggiustamenti su return rate,
 * safety, quality.
 */
export function computeMarketRiskScore(market: MarketRiskData): number {
  let score = 75

  if (market.expectedReturnRate < 0.05) score += 15
  else if (market.expectedReturnRate < 0.1) score += 5
  else if (market.expectedReturnRate < 0.15) score += 0
  else if (market.expectedReturnRate < 0.2) score -= 10
  else score -= 25

  if (market.productSafetyConcerns) score -= 20
  if (market.qualityIssuesReported) score -= 10

  return Math.max(0, Math.min(100, Math.round(score)))
}

function makeFallbackOutput(reason: string): WorkerOutput<RiskData> {
  return {
    score: 50,
    data: {
      marketRisk: {
        expectedReturnRate: 0.1,
        expectedReturnIssues: false,
        productSafetyConcerns: false,
        qualityIssuesReported: false,
      },
      compliance: {
        severity: "none",
        restrictedCategory: false,
        restrictedPlatforms: [],
        trademarkRisk: "unknown",
        trademarkDetails: null,
        ceComplianceRequired: false,
        reasons: [],
      },
    },
    evidence: [],
    warnings: [`Worker risk fallito o degraded: ${reason}`],
    dataAvailable: false,
    dataConfidence: "unknown",
  }
}

export interface RunRiskWorkerResult {
  output: WorkerOutput<RiskData>
  costEur: number
}

export async function runRiskWorker(
  input: AnalysisInput,
): Promise<RunRiskWorkerResult> {
  const start = Date.now()
  logJson({ event: "worker_risk_start", productName: input.productName })
  try {
    return await withTimeout(
      (signal) => runRiskWorkerInner(input, start, signal),
      TIMEOUT_MS,
      "risk_worker",
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logJson({
      event: "worker_risk_error",
      productName: input.productName,
      error: message,
      durationMs: Date.now() - start,
    })
    return { output: makeFallbackOutput(message), costEur: 0 }
  }
}

async function runRiskWorkerInner(
  input: AnalysisInput,
  start: number,
  signal: AbortSignal,
): Promise<RunRiskWorkerResult> {
  const search = await searchWeb({
    query: `${input.productName} trademark patent litigation safety recall compliance recensioni qualità`,
    contextHint: "risk_legal_compliance",
    maxUses: SEARCH_MAX_USES,
    signal,
  })
  const searchCost = search.costEur

  const result = await callClaude({
    model: "sonnet-4-5",
    system: buildSystemPrompt(),
    prompt: buildUserPrompt(input, search),
    tools: [REPORT_RISK_TOOL],
    toolChoice: { type: "tool", name: TOOL_NAME },
    maxTokens: 1500,
    signal,
  })
  const reasoningCost = result.usage.costEur

  for (const block of result.content) {
    if (block.type !== "tool_use") continue
    if (block.name !== TOOL_NAME) continue
    const parsed = RiskToolInputSchema.safeParse(block.input)
    if (!parsed.success) {
      logJson({
        event: "worker_risk_invalid_tool_input",
        productName: input.productName,
        errors: parsed.error.flatten(),
      })
      return {
        output: makeFallbackOutput("tool input validation failed"),
        costEur: searchCost + reasoningCost,
      }
    }

    const llm = parsed.data.data
    const category = llm.categoryClassification

    // Lookup deterministici di compliance.
    const restrictedCategory = isRestrictedCategory(
      category,
      input.userChannel,
    )
    const restrictedPlatforms = getRestrictedPlatforms(category)
    const ceRequired = ceComplianceRequiredForCategory(category)

    const severity = computeComplianceSeverity({
      restricted: restrictedCategory,
      trademarkRisk: llm.trademarkRisk,
      ceRequired,
    })

    const reasons = buildReasonsList({
      restricted: restrictedCategory,
      restrictedPlatforms,
      trademarkRisk: llm.trademarkRisk,
      trademarkDetails: llm.trademarkDetails,
      ceRequired,
      category,
    })

    const compliance: ComplianceFlag = {
      severity,
      restrictedCategory,
      restrictedPlatforms,
      trademarkRisk: llm.trademarkRisk,
      trademarkDetails: llm.trademarkDetails,
      ceComplianceRequired: ceRequired,
      reasons,
    }

    // Market risk: usiamo il benchmark interno per expectedReturnRate
    // (calibrato), ma rispettiamo la stima LLM se è più alta di una soglia
    // (i.e., l'LLM ha trovato segnali specifici di reso elevato).
    const benchmarkReturnRate = lookupReturnRate(category)
    const expectedReturnRate = Math.max(
      benchmarkReturnRate,
      llm.expectedReturnRate,
    )
    const marketRisk: MarketRiskData = {
      expectedReturnRate,
      expectedReturnIssues: expectedReturnRate > RETURN_RATE_VETO_THRESHOLD,
      productSafetyConcerns: llm.productSafetyConcerns,
      qualityIssuesReported: llm.qualityIssuesReported,
    }

    const riskData: RiskData = { marketRisk, compliance }
    const score = computeMarketRiskScore(marketRisk)
    const output: WorkerOutput<RiskData> = {
      score,
      data: riskData,
      evidence: parsed.data.evidence,
      warnings: parsed.data.warnings,
      dataAvailable: true,
      dataConfidence: parsed.data.dataConfidence,
    }
    logJson({
      event: "worker_risk_done",
      productName: input.productName,
      score,
      complianceSeverity: severity,
      restrictedCategory,
      trademarkRisk: llm.trademarkRisk,
      ceRequired,
      expectedReturnRate,
      productSafetyConcerns: llm.productSafetyConcerns,
      dataConfidence: output.dataConfidence,
      searchCostEur: searchCost,
      reasoningCostEur: reasoningCost,
      durationMs: Date.now() - start,
    })
    return { output, costEur: searchCost + reasoningCost }
  }

  logJson({
    event: "worker_risk_no_tool_call",
    productName: input.productName,
    costEur: searchCost + reasoningCost,
  })
  return {
    output: makeFallbackOutput("model did not call report_risk"),
    costEur: searchCost + reasoningCost,
  }
}
