// Aggregator (CONTEXT.md sez. 3 + 9).
//
// Step:
// A. Calcolo deterministico dello score finale (NO LLM): media pesata + cap
//    veto rules + mappatura cromatica.
// B. Calcolo dataIntegrity (frazione di worker con dataAvailable=true) e
//    dataConfidenceByDimension.
// C. Generazione narrativa via Sonnet 4.5 (verdict, strengths, risks,
//    recommendation, breakdown). LLM riceve lo score già calcolato e NON
//    può ricalcolarlo.
// D. Composizione FinalReport.

import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { callClaude } from "@/lib/anthropic"
import { resolveQuantitativeEstimate, withTimeout } from "@/lib/utils"
import {
  GROSS_MARGIN_VETO_RED,
  GROSS_MARGIN_VETO_YELLOW,
} from "@/benchmarks/margin-thresholds"
import { RETURN_RATE_VETO_THRESHOLD } from "@/benchmarks/return-rates"
import type {
  AnalysisInput,
  ComplianceFlag,
  DemandData,
  DimensionBreakdown,
  DimensionKey,
  EconomicsBreakdownData,
  EconomicsData,
  FinalReport,
  FitData,
  ReportColor,
  RiskData,
  SaturationData,
  WorkerOutput,
} from "@/agent/types"

// Deviazione da CONTEXT.md sez. 5: la narrativa Sonnet 4.5 con context dei 5
// WorkerOutput (~3k input tokens, 1k output) richiede ~25-30s; sotto carico
// di sistema in casi p95 può arrivare a 40-50s. 60s dà buffer p99.
const TIMEOUT_MS = 60_000
const TOOL_NAME = "report_narrative"

const WEIGHTS: Record<DimensionKey, number> = {
  demand: 0.20,
  saturation: 0.20,
  economics: 0.30,
  fit: 0.15,
  risk: 0.15,
}

interface AggregatorWorkers {
  demand: WorkerOutput<DemandData>
  saturation: WorkerOutput<SaturationData>
  economics: WorkerOutput<EconomicsData>
  fit: WorkerOutput<FitData>
  risk: WorkerOutput<RiskData>
}

export interface RunAggregatorArgs {
  input: AnalysisInput
  workers: AggregatorWorkers
  workersCostEur: number
}

export interface RunAggregatorResult {
  report: FinalReport
  costEur: number
}

function logJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

function colorForScore(score: number): ReportColor {
  if (score >= 85) return "verde-acceso"
  if (score >= 70) return "verde"
  if (score >= 55) return "giallo"
  if (score >= 40) return "arancione"
  return "rosso"
}

interface DeterministicEval {
  weightedScore: number
  finalScore: number
  color: ReportColor
  vetoTriggered: boolean
  vetoReasons: string[]
  dataIntegrity: number
  dataConfidenceByDimension: Record<DimensionKey, WorkerOutput<unknown>["dataConfidence"]>
}

function computeDeterministic(workers: AggregatorWorkers): DeterministicEval {
  const weightedScore =
    workers.demand.score * WEIGHTS.demand +
    workers.saturation.score * WEIGHTS.saturation +
    workers.economics.score * WEIGHTS.economics +
    workers.fit.score * WEIGHTS.fit +
    workers.risk.score * WEIGHTS.risk

  let cap = 100
  const vetoReasons: string[] = []

  // Le veto rules legate a COMPLIANCE (categoria ristretta, trademark high)
  // NON cap-pano più lo score. Il rischio compliance è esposto separatamente
  // come `complianceAlert` nel FinalReport. Lo score riflette solo
  // l'opportunità di mercato del prodotto.

  // Economics vetoes: applichiamo solo se economics ha dati reali (defense
  // in depth: il fallback ha valori veto-safe ma checkare dataAvailable evita
  // qualsiasi sorpresa).
  if (workers.economics.dataAvailable) {
    const e = workers.economics.data
    if (e.grossMarginPct < GROSS_MARGIN_VETO_RED) {
      cap = Math.min(cap, 30)
      vetoReasons.push(
        `Margine lordo ${(e.grossMarginPct * 100).toFixed(1)}% sotto soglia 30%`,
      )
    } else if (e.grossMarginPct < GROSS_MARGIN_VETO_YELLOW) {
      cap = Math.min(cap, 54)
      vetoReasons.push(
        `Margine lordo ${(e.grossMarginPct * 100).toFixed(1)}% sotto soglia 50%`,
      )
    }
    if (e.expectedReturnRate > RETURN_RATE_VETO_THRESHOLD) {
      cap = Math.min(cap, 54)
      vetoReasons.push(
        `Tasso reso atteso ${(e.expectedReturnRate * 100).toFixed(1)}% sopra soglia 20%`,
      )
    }
  }

  const finalScore = Math.round(Math.max(0, Math.min(cap, weightedScore)))
  const color = colorForScore(finalScore)
  const vetoTriggered = vetoReasons.length > 0

  const workersWithData = [
    workers.demand,
    workers.saturation,
    workers.economics,
    workers.fit,
    workers.risk,
  ].filter((w) => w.dataAvailable).length
  const dataIntegrity = workersWithData / 5

  const dataConfidenceByDimension: Record<
    DimensionKey,
    WorkerOutput<unknown>["dataConfidence"]
  > = {
    demand: workers.demand.dataConfidence,
    saturation: workers.saturation.dataConfidence,
    economics: workers.economics.dataConfidence,
    fit: workers.fit.dataConfidence,
    risk: workers.risk.dataConfidence,
  }

  return {
    weightedScore,
    finalScore,
    color,
    vetoTriggered,
    vetoReasons,
    dataIntegrity,
    dataConfidenceByDimension,
  }
}

// --- Narrativa LLM ---

const NARRATIVE_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Riporta verdict narrativo, strengths, risks, recommendation, breakdown per dimensione. NON ricalcolare lo score: lo ricevi già dal sistema.",
  input_schema: {
    type: "object",
    properties: {
      verdict: {
        type: "string",
        description:
          "2 frasi. Prima: 'cosa è questo prodotto in questa configurazione'. Seconda: 'cosa significa per l'utente'.",
      },
      strengths: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" },
        description:
          "Esattamente 3 punti di forza concreti, autocontenuti, ordinati per rilevanza.",
      },
      risks: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: { type: "string" },
        description:
          "Esattamente 3 rischi ordinati per gravità (peggiore primo). Se ci sono veto attivi, MENZIONALI esplicitamente come primo rischio.",
      },
      recommendation: {
        type: "string",
        description:
          "Stringa azionabile. Schema: 'Test con budget X€ per Y giorni focalizzando creative su Z' OPPURE 'Evita: ragione W'.",
      },
      breakdown: {
        type: "object",
        properties: {
          demand: { type: "string" },
          saturation: { type: "string" },
          economics: { type: "string" },
          fit: { type: "string" },
          risk: { type: "string" },
        },
        required: ["demand", "saturation", "economics", "fit", "risk"],
        description:
          "Una stringa per ogni dimensione: 1 frase che spiega il risultato + la sua confidence (es. 'Saturazione: dati limitati, mercato probabilmente competitivo - confidence media').",
      },
    },
    required: ["verdict", "strengths", "risks", "recommendation", "breakdown"],
  },
}

const NarrativeSchema = z.object({
  verdict: z.string().min(1),
  strengths: z.tuple([z.string(), z.string(), z.string()]),
  risks: z.tuple([z.string(), z.string(), z.string()]),
  recommendation: z.string().min(1),
  breakdown: z.object({
    demand: z.string(),
    saturation: z.string(),
    economics: z.string(),
    fit: z.string(),
    risk: z.string(),
  }),
})

function buildNarrativeSystemPrompt(): string {
  return `Sei un analista esperto di e-commerce e dropshipping per il mercato italiano. Hai ricevuto i risultati di un'analisi prodotto su 5 dimensioni con score già calcolato deterministicamente.

Il tuo compito: produrre un verdetto narrativo onesto, diretto, mai venditoriale. Tono da operatore esperto che parla a un peer, non da marketer.

REGOLA DI ONESTÀ SUI DATI INCERTI: se dataIntegrity < 0.6 o se 2+ dimensioni hanno dataConfidence in [low, unknown], modera il tuo verdict. Frasi come 'i dati raccolti sono parziali, ma sui segnali disponibili...' sono preferibili a verdetti netti basati su poco. La tua credibilità dipende dal non sovrastimare la solidità delle conclusioni.

COMPLIANCE NOTE: il rischio compliance (categoria ristretta, trademark) NON è parte della valutazione di mercato. Lo score finale riflette solo l'opportunità di mercato del prodotto. Se ci sono problemi compliance, l'utente li vedrà in un banner separato. Nel verdict narrativo, NON dire mai 'evita questo prodotto perché restricted', 'questo prodotto non si può vendere', o simili. Puoi menzionarlo nella recommendation come fattore operativo da gestire ('Nota: il prodotto è ristretto su Meta — considera canali alternativi'), ma il prodotto resta una opportunità di mercato valida o meno indipendentemente dalla compliance. Il workers.risk.data ora ha DUE blocchi: marketRisk (return rate, qualità, sicurezza — questo influenza lo score) e compliance (restricted/trademark — separato). Quando commenti il breakdown.risk, parla SOLO di market risk.

ESPERIENZA CREATIVE — DUE DIMENSIONI SEPARATE:
L'utente ha dichiarato due livelli separati di esperienza creative: imageExperience e videoExperience (ognuno in 4 livelli: none/basic/intermediate/proven). Quando commenti il fit nella sezione 'breakdown.fit', distingui se il bottleneck è sulle immagini o sui video — guarda i campi imageGap e videoGap nei WorkerOutput.fit.data: positivi = utente sotto il livello richiesto dal canale. Se uno dei due è significativamente sotto (gap >= 2), menzionalo esplicitamente nel verdict come fattore principale. Se entrambi sono adeguati (gap = 0), non commentare il creative gap.

REGOLE OUTPUT:
- verdict: 2 frasi che sintetizzano la valutazione complessiva. La prima dice 'cosa è questo prodotto in questa configurazione', la seconda dice 'cosa significa per l'utente'.
- strengths: 3 punti di forza concreti, ordinati per rilevanza. Ogni stringa deve essere autocontenuta (l'utente la legge senza contesto).
- risks: 3 rischi ordinati per gravità (peggiore primo). Se ci sono veto attivi, MENZIONALI esplicitamente come primo rischio.
- recommendation: stringa azionabile. Schema: 'Test con budget X€ per Y giorni focalizzando creative su Z' OPPURE 'Evita: ragione W'. Mai vago.
- breakdown: una stringa per ogni dimensione (demand, saturation, economics, fit, risk) che spiega in 1 frase il risultato di quella dimensione + la sua confidence ('Saturazione: dati limitati, mercato probabilmente competitivo - confidence media').

NON inventare numeri o dati che non sono nei WorkerOutput ricevuti. NON ricalcolare lo score. Lo score finale è quello che ti è stato dato.`
}

function buildNarrativeUserPrompt(
  input: AnalysisInput,
  workers: AggregatorWorkers,
  evalResult: DeterministicEval,
): string {
  return [
    "PRODOTTO:",
    `- Nome: ${input.productName}`,
    `- Descrizione: ${input.productDescription ?? "(non fornita)"}`,
    `- COGS: ${input.productCogs !== undefined ? `${input.productCogs}€` : "(non fornito)"}`,
    `- Budget mensile utente: ${input.userBudget}€`,
    `- Canale utente: ${input.userChannel}`,
    `- Mercato: ${input.userMarket}`,
    `- Esperienza immagini per ads: ${input.userImageExperience}`,
    `- Esperienza video per ads: ${input.userVideoExperience}`,
    "",
    "SCORE FINALE GIÀ CALCOLATO (non ricalcolare):",
    `- finalScore: ${evalResult.finalScore} (${evalResult.color})`,
    `- economicVetoTriggered: ${evalResult.vetoTriggered}${evalResult.vetoReasons.length > 0 ? ` — motivi economici: ${evalResult.vetoReasons.join("; ")}` : ""}`,
    `- dataIntegrity: ${(evalResult.dataIntegrity * 100).toFixed(0)}%`,
    `- dataConfidenceByDimension: ${JSON.stringify(evalResult.dataConfidenceByDimension)}`,
    "",
    "WORKER OUTPUT (5 dimensioni):",
    JSON.stringify(workers, null, 2),
    "",
    `Genera la narrativa via tool ${TOOL_NAME}.`,
  ].join("\n")
}

interface FallbackNarrative {
  verdict: string
  strengths: [string, string, string]
  risks: [string, string, string]
  recommendation: string
  breakdown: Record<DimensionKey, string>
}

function makeFallbackNarrative(
  evalResult: DeterministicEval,
  reason: string,
): FallbackNarrative {
  const sev = evalResult.vetoTriggered ? "non procedere" : "procedere con cautela"
  const dataNote =
    evalResult.dataIntegrity < 0.6
      ? "I dati raccolti sono parziali"
      : "I dati raccolti sono completi ma la narrativa AI non è disponibile"
  return {
    verdict: `${dataNote}. Score deterministico: ${evalResult.finalScore} (${evalResult.color}). Raccomandazione automatica: ${sev}.`,
    strengths: [
      "Vedi worker output per dettagli (narrativa AI non disponibile).",
      "Score deterministico calcolato correttamente sui benchmark.",
      "Pesi e veto rules applicati come da specifica.",
    ],
    risks: [
      evalResult.vetoTriggered
        ? `Veto attivo: ${evalResult.vetoReasons.join("; ")}`
        : "Vedi warnings dei singoli worker per dettagli.",
      `Narrativa aggregator non disponibile: ${reason}`,
      "Considerare rilancio manuale dell'analisi se la narrativa è critica.",
    ],
    recommendation: evalResult.vetoTriggered
      ? `Evita: ${evalResult.vetoReasons[0] ?? "veto attivo"}.`
      : "Rilanciare l'analisi: la narrativa AI non è stata generata.",
    breakdown: {
      demand: "Narrativa AI non disponibile per questa dimensione.",
      saturation: "Narrativa AI non disponibile per questa dimensione.",
      economics: "Narrativa AI non disponibile per questa dimensione.",
      fit: "Narrativa AI non disponibile per questa dimensione.",
      risk: "Narrativa AI non disponibile per questa dimensione.",
    },
  }
}

async function runNarrativeLLM(
  input: AnalysisInput,
  workers: AggregatorWorkers,
  evalResult: DeterministicEval,
): Promise<{ narrative: FallbackNarrative; costEur: number; aiGenerated: boolean }> {
  try {
    const result = await withTimeout(
      (signal) =>
        callClaude({
          model: "sonnet-4-5",
          system: buildNarrativeSystemPrompt(),
          prompt: buildNarrativeUserPrompt(input, workers, evalResult),
          tools: [NARRATIVE_TOOL],
          toolChoice: { type: "tool", name: TOOL_NAME },
          maxTokens: 2500,
          signal,
        }),
      TIMEOUT_MS,
      "aggregator_narrative",
    )

    for (const block of result.content) {
      if (block.type !== "tool_use") continue
      if (block.name !== TOOL_NAME) continue
      const parsed = NarrativeSchema.safeParse(block.input)
      if (!parsed.success) {
        logJson({
          event: "aggregator_invalid_narrative",
          errors: parsed.error.flatten(),
        })
        return {
          narrative: makeFallbackNarrative(
            evalResult,
            "narrative validation failed",
          ),
          costEur: result.usage.costEur,
          aiGenerated: false,
        }
      }
      return {
        narrative: parsed.data,
        costEur: result.usage.costEur,
        aiGenerated: true,
      }
    }

    return {
      narrative: makeFallbackNarrative(evalResult, "model did not call tool"),
      costEur: result.usage.costEur,
      aiGenerated: false,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logJson({ event: "aggregator_narrative_error", error: message })
    return {
      narrative: makeFallbackNarrative(evalResult, message),
      costEur: 0,
      aiGenerated: false,
    }
  }
}

export async function runAggregator(
  args: RunAggregatorArgs,
): Promise<RunAggregatorResult> {
  const start = Date.now()
  logJson({
    event: "aggregator_start",
    productName: args.input.productName,
    workersCostEur: args.workersCostEur,
  })

  const evalResult = computeDeterministic(args.workers)
  logJson({
    event: "aggregator_deterministic_done",
    finalScore: evalResult.finalScore,
    color: evalResult.color,
    vetoTriggered: evalResult.vetoTriggered,
    dataIntegrity: evalResult.dataIntegrity,
  })

  const { narrative, costEur: narrativeCost, aiGenerated } =
    await runNarrativeLLM(args.input, args.workers, evalResult)

  // Estraiamo il pannello economico strutturato SOLO se il worker ha dati
  // reali. Per l'utente questo è il "wow moment" del report (donut margine,
  // ROAS, CPA vs budget) e l'aggregator espone i numeri già risolti dai
  // benchmark — il frontend non deve più gestire QuantitativeEstimate qui.
  const eco = args.workers.economics
  const economicsData: EconomicsBreakdownData | undefined = eco.dataAvailable
    ? {
        estimatedCogs: resolveQuantitativeEstimate(eco.data.estimatedCogs),
        suggestedRetailPrice: eco.data.suggestedRetailPrice,
        grossMarginPct: eco.data.grossMarginPct,
        estimatedCpm: eco.data.estimatedCpm,
        estimatedCpa: eco.data.estimatedCpa,
        breakevenRoas: eco.data.breakevenRoas,
        profitableAtUserBudget: eco.data.profitableAtUserBudget,
        expectedReturnRate: eco.data.expectedReturnRate,
        categoryClassification: eco.data.categoryClassification,
      }
    : undefined

  const breakdown: FinalReport["breakdown"] = {
    demand: {
      score: args.workers.demand.score,
      summary: narrative.breakdown.demand,
      dataConfidence: args.workers.demand.dataConfidence,
    },
    saturation: {
      score: args.workers.saturation.score,
      summary: narrative.breakdown.saturation,
      dataConfidence: args.workers.saturation.dataConfidence,
    },
    economics: {
      score: args.workers.economics.score,
      summary: narrative.breakdown.economics,
      dataConfidence: args.workers.economics.dataConfidence,
      data: economicsData,
    },
    fit: {
      score: args.workers.fit.score,
      summary: narrative.breakdown.fit,
      dataConfidence: args.workers.fit.dataConfidence,
    },
    risk: {
      score: args.workers.risk.score,
      summary: narrative.breakdown.risk,
      dataConfidence: args.workers.risk.dataConfidence,
    },
  }

  // Compliance flag: passa-attraverso dal worker risk se disponibile.
  // In caso di fallback (worker risk fallito), severity = "none" — l'utente
  // vedrà solo che il worker non ha dati ma niente banner critical falso.
  const complianceAlert: ComplianceFlag = args.workers.risk.dataAvailable
    ? args.workers.risk.data.compliance
    : {
        severity: "none",
        restrictedCategory: false,
        restrictedPlatforms: [],
        trademarkRisk: "unknown",
        trademarkDetails: null,
        ceComplianceRequired: false,
        reasons: [],
      }

  const totalCostEur = args.workersCostEur + narrativeCost
  const report: FinalReport = {
    score: evalResult.finalScore,
    color: evalResult.color,
    verdict: narrative.verdict,
    strengths: narrative.strengths,
    risks: narrative.risks,
    recommendation: narrative.recommendation,
    breakdown,
    totalCostEur,
    complianceAlert,
    dataIntegrity: evalResult.dataIntegrity,
    dataConfidenceByDimension: evalResult.dataConfidenceByDimension,
  }

  logJson({
    event: "aggregator_done",
    productName: args.input.productName,
    finalScore: report.score,
    color: report.color,
    complianceSeverity: complianceAlert.severity,
    economicVetoTriggered: evalResult.vetoTriggered,
    dataIntegrity: report.dataIntegrity,
    aiGenerated,
    narrativeCostEur: narrativeCost,
    totalCostEur,
    durationMs: Date.now() - start,
  })

  return { report, costEur: narrativeCost }
}
