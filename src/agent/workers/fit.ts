// Worker D4 — Fit con utente (CONTEXT.md sez. 3 D4, peso 15%).
//
// Caratteristiche:
// - NO fonti esterne: solo logica + reasoning Sonnet 4.5.
// - Una singola call Claude con tool use forzato (tool_choice = report_fit).
// - Timeout interno 15s via withTimeout di utils.
// - Su timeout/errore: WorkerOutput degraded (dataAvailable=false, score=50,
//   dataConfidence="unknown") — mai eccezione propagata.
// - Score deterministico calcolato da computeFitScore() sui campi LLM,
//   NON è il modello a sceglierlo: è una formula auditabile.
// - Le due dimensioni creative (image + video) sono confrontate con i
//   requisiti del canale e producono imageGap/videoGap; la dimensione più
//   debole fa da bottleneck nello score.

import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { callClaude } from "@/lib/anthropic"
import { withTimeout } from "@/lib/utils"
import { FitDataSchema } from "@/agent/schemas"
import type {
  AnalysisInput,
  CreativeExperienceLevel,
  FitData,
  UserChannel,
  WorkerOutput,
} from "@/agent/types"

const TIMEOUT_MS = 15_000
const TOOL_NAME = "report_fit"

const ASSUMED_CPA_EUR = 30
const MIN_TEST_BUDGET_EUR = Math.max(300, 3 * ASSUMED_CPA_EUR * 30) // = 2700

// Ranking ordinale dei livelli di esperienza creative.
const LEVEL_RANK: Record<CreativeExperienceLevel, number> = {
  none: 0,
  basic: 1,
  intermediate: 2,
  proven: 3,
}

interface ChannelRequirements {
  imageRequired: CreativeExperienceLevel
  videoRequired: CreativeExperienceLevel
}

// Requisiti minimi di esperienza per canale (image + video). Documenta il
// "che livello serve" su ogni canale; calibrato su empiriche di
// performance dropshipping (TikTok = video-driven, Amazon = image-driven).
const CHANNEL_CREATIVE_REQUIREMENTS: Record<UserChannel, ChannelRequirements> =
  {
    tiktok_shop: { imageRequired: "basic", videoRequired: "intermediate" },
    shopify_meta: { imageRequired: "intermediate", videoRequired: "basic" },
    shopify_tiktok: {
      imageRequired: "basic",
      videoRequired: "intermediate",
    },
    amazon_fba: { imageRequired: "intermediate", videoRequired: "none" },
  }

const REPORT_FIT_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    "Riporta il risultato strutturato della valutazione 'Fit con utente'. Da chiamare come unico output dopo aver ragionato sul prodotto e sul setup utente. NON devi calcolare minTestBudgetEur né i creative gap: sono calcolati deterministicamente in codice.",
  input_schema: {
    type: "object",
    properties: {
      data: {
        type: "object",
        properties: {
          recommendedChannel: {
            type: "string",
            enum: [
              "tiktok_shop",
              "shopify_meta",
              "shopify_tiktok",
              "amazon_fba",
            ],
            description:
              "Canale raccomandato in base alla natura del prodotto (impulse buy → tiktok_shop, high-ticket → shopify_meta, problem-solving search-driven → shopify_meta o amazon_fba).",
          },
          daysToValidate: {
            type: "number",
            minimum: 0,
            description: "Giorni stimati per validare il prodotto. Tipicamente 7-21.",
          },
          channelMatchScore: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description:
              "Quanto userChannel matcha recommendedChannel. Match esatto: 90-100. Vicino: 60-80. Scollato: 20-40.",
          },
        },
        required: [
          "recommendedChannel",
          "daysToValidate",
          "channelMatchScore",
        ],
      },
      evidence: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        description:
          "3-5 stringhe in italiano che spiegano il ragionamento. Se commenti l'esperienza creative, distingui esplicitamente immagini vs video (sono due livelli separati ora).",
        items: { type: "string" },
      },
      warnings: {
        type: "array",
        description:
          "Solo red flag concreti sulla parte qualitativa (canale scollato, prodotto inadatto al canale). NON commentare i creative gap qui — vengono aggiunti dal sistema in base ai livelli dichiarati.",
        items: { type: "string" },
      },
      dataConfidence: {
        type: "string",
        enum: ["high", "medium"],
        description:
          "high se input ricco e match chiaro; medium se descrizione povera o segnale ambiguo.",
      },
    },
    required: ["data", "evidence", "warnings", "dataConfidence"],
  },
}

// L'LLM produce solo i 3 campi qualitativi; tutto il resto (minTestBudget,
// creativeCapacityMatch, imageGap, videoGap) è calcolato in codice.
const FitLLMDataSchema = FitDataSchema.pick({
  recommendedChannel: true,
  daysToValidate: true,
  channelMatchScore: true,
})

const FitToolInputSchema = z.object({
  data: FitLLMDataSchema,
  evidence: z.array(z.string()).min(3).max(5),
  warnings: z.array(z.string()),
  dataConfidence: z.enum(["high", "medium"]),
})

function buildSystemPrompt(): string {
  return [
    "Sei l'analista che valuta la dimensione \"Fit con utente\" per un prodotto ecommerce.",
    "Analizzi il match tra il prodotto e il setup operativo dell'utente (budget, canale di vendita, ESPERIENZA CREATIVE).",
    "",
    "REGOLE ANTI-ALLUCINAZIONE (CONTEXT.md sez. 6.4):",
    "- Mai inventare numeri precisi senza giustificazione.",
    "- Quando incerto, scegli il valore più conservativo.",
    "- Le tue deduzioni sono qualitative: prodotto + setup utente, NON fonti esterne.",
    "",
    "ESPERIENZA CREATIVE — DUE DIMENSIONI INDIPENDENTI:",
    "L'utente dichiara DUE livelli separati: userImageExperience (per le foto/A+ content) e userVideoExperience (per UGC/demo video).",
    "Ogni livello è in 4 step: none / basic / intermediate / proven.",
    "Il sistema calcolerà DA SOLO la distanza tra i livelli dichiarati e i requisiti del canale, e applicherà penalità di score in base al gap. NON serve che lo faccia tu.",
    "Quando commenti il fit nelle evidence, distingui se la criticità è sulle immagini o sui video; non parlare di una 'capacità creative' generica.",
    "",
    "LOGICA recommendedChannel:",
    "- Prodotto impulse buy / visivamente accattivante (gadget, beauty viral, problem-solver visibile) → tiktok_shop",
    "- High-ticket (COGS > 50€ oppure prezzo retail atteso > 100€) → shopify_meta",
    "- Problem-solving ricerca-driven (utensile da cucina, integratore funzionale, tech utility) → shopify_meta o amazon_fba",
    "",
    "LOGICA daysToValidate: tipicamente 7-21 giorni.",
    "",
    "LOGICA channelMatchScore (0-100):",
    "- userChannel == recommendedChannel: 90-100.",
    "- Vicino (es. tiktok_shop vs shopify_tiktok, entrambi TikTok-driven): 60-80.",
    "- Scollato (es. tiktok_shop per high-ticket B2B): 20-40.",
    "",
    "DATA CONFIDENCE: solo \"high\" o \"medium\".",
    "- \"high\": prodotto chiaro, setup utente coerente, deduzione ovvia.",
    "- \"medium\": descrizione povera o segnale ambiguo.",
    "",
    "NOTA: minTestBudgetEur, creativeCapacityMatch, imageGap, videoGap NON sono",
    "di tua competenza — vengono calcolati dal sistema. Non includerli.",
    "",
    `OUTPUT: chiama il tool ${TOOL_NAME}. Non rispondere in prosa.`,
  ].join("\n")
}

function buildUserPrompt(input: AnalysisInput): string {
  const lines: string[] = ["PRODOTTO:"]
  lines.push(`- Nome: ${input.productName}`)
  lines.push(
    `- Descrizione: ${input.productDescription ?? "(non fornita)"}`,
  )
  lines.push(
    `- COGS: ${input.productCogs !== undefined ? `${input.productCogs}€` : "(non fornito)"}`,
  )
  lines.push(`- URL: ${input.productUrl ?? "(non fornito)"}`)
  lines.push("")
  lines.push("SETUP UTENTE:")
  lines.push(`- Budget mensile: ${input.userBudget}€`)
  lines.push(`- Canale di vendita: ${input.userChannel}`)
  lines.push(`- Mercato: ${input.userMarket}`)
  lines.push(`- Esperienza immagini per ads: ${input.userImageExperience}`)
  lines.push(`- Esperienza video per ads: ${input.userVideoExperience}`)
  lines.push("")
  lines.push(`Valuta il fit e chiama ${TOOL_NAME}.`)
  return lines.join("\n")
}

export interface FitScoreResult {
  score: number
  additionalWarnings: string[]
}

interface CreativeGaps {
  imageGap: number
  videoGap: number
  effectiveDistance: number
  imageRequired: CreativeExperienceLevel
  videoRequired: CreativeExperienceLevel
}

/**
 * Calcola i gap creative tra i livelli dichiarati dall'utente e i requisiti
 * del canale. Distanza positiva = utente sotto il richiesto. La distanza
 * effettiva è il MAX dei due (collo di bottiglia).
 */
function computeCreativeGaps(input: AnalysisInput): CreativeGaps {
  const reqs = CHANNEL_CREATIVE_REQUIREMENTS[input.userChannel]
  const imageGap = Math.max(
    0,
    LEVEL_RANK[reqs.imageRequired] - LEVEL_RANK[input.userImageExperience],
  )
  const videoGap = Math.max(
    0,
    LEVEL_RANK[reqs.videoRequired] - LEVEL_RANK[input.userVideoExperience],
  )
  return {
    imageGap,
    videoGap,
    effectiveDistance: Math.max(imageGap, videoGap),
    imageRequired: reqs.imageRequired,
    videoRequired: reqs.videoRequired,
  }
}

const LEVEL_LABELS: Record<CreativeExperienceLevel, string> = {
  none: "nessuna",
  basic: "base",
  intermediate: "intermedia",
  proven: "provata",
}

/**
 * Score finale del worker fit (0-100).
 *
 * Componenti pesati:
 * - channelMatchScore × 0.50 — fornito dall'LLM.
 * - budgetSufficiency × 0.30 — curva concava 100 × ratio^1.5.
 * - creativeCapacityMatch × 0.20 — 100 se nessun gap, 30 altrimenti.
 *
 * Penalità basate sulla distanza effettiva (max(imageGap, videoGap)):
 * - effectiveDistance >= 1 → -10
 * - effectiveDistance >= 2 → -20 (sostituisce -10)
 * - effectiveDistance >= 3 → -30 + soft cap 50
 *
 * Soft cap TikTok Shop: se userVideoExperience < intermediate, score capped
 * a 65 — il video è de facto obbligatorio sul canale TikTok Shop.
 */
export function computeFitScore(
  input: AnalysisInput,
  data: FitData,
): FitScoreResult {
  const additionalWarnings: string[] = []

  const channelMatch = data.channelMatchScore

  const sufficiencyRatio =
    data.minTestBudgetEur > 0
      ? Math.min(1, input.userBudget / data.minTestBudgetEur)
      : 1
  const budgetSufficiency = 100 * Math.pow(sufficiencyRatio, 1.5)

  const creativeMatch = data.creativeCapacityMatch ? 100 : 30

  const weighted =
    channelMatch * 0.5 + budgetSufficiency * 0.3 + creativeMatch * 0.2
  let baseScore = Math.max(0, Math.min(100, weighted))

  // Penalità basate sui gap effettivi.
  const reqs = CHANNEL_CREATIVE_REQUIREMENTS[input.userChannel]
  const effectiveDistance = Math.max(data.imageGap, data.videoGap)
  let penalty = 0
  if (effectiveDistance >= 1) penalty = 10
  if (effectiveDistance >= 2) penalty = 20
  if (effectiveDistance >= 3) penalty = 30

  if (effectiveDistance >= 1) {
    // Warning specifico alla dimensione bottleneck.
    if (data.videoGap >= data.imageGap && data.videoGap >= 1) {
      additionalWarnings.push(
        `Esperienza video sotto il livello richiesto per il canale ${input.userChannel} (richiesto: ${LEVEL_LABELS[reqs.videoRequired]}, dichiarato: ${LEVEL_LABELS[input.userVideoExperience]}).`,
      )
    } else if (data.imageGap > data.videoGap && data.imageGap >= 1) {
      additionalWarnings.push(
        `Esperienza immagini sotto il livello richiesto per il canale ${input.userChannel} (richiesto: ${LEVEL_LABELS[reqs.imageRequired]}, dichiarato: ${LEVEL_LABELS[input.userImageExperience]}).`,
      )
    }
  }

  baseScore -= penalty
  baseScore = Math.max(0, baseScore)

  if (effectiveDistance >= 3) {
    if (baseScore > 50) {
      additionalWarnings.push(
        "Score limitato a 50: gap creative troppo ampio rispetto ai requisiti del canale.",
      )
    }
    baseScore = Math.min(baseScore, 50)
  }

  // Soft cap TikTok Shop: video è critico, sotto intermediate il canale non
  // funziona indipendentemente dal resto.
  if (
    input.userChannel === "tiktok_shop" &&
    LEVEL_RANK[input.userVideoExperience] < LEVEL_RANK.intermediate
  ) {
    if (baseScore > 65) {
      additionalWarnings.push(
        "Score limitato a 65: TikTok Shop richiede capacità video almeno intermediate per essere competitivo.",
      )
    }
    baseScore = Math.min(baseScore, 65)
  }

  return {
    score: Math.round(baseScore),
    additionalWarnings,
  }
}

function makeFallbackOutput(
  input: AnalysisInput,
  reason: string,
): WorkerOutput<FitData> {
  return {
    score: 50,
    data: {
      minTestBudgetEur: 0,
      recommendedChannel: input.userChannel,
      daysToValidate: 0,
      channelMatchScore: 0,
      creativeCapacityMatch: false,
      imageGap: 0,
      videoGap: 0,
    },
    evidence: [],
    warnings: [`Worker fit fallito o degraded: ${reason}`],
    dataAvailable: false,
    dataConfidence: "unknown",
  }
}

function logJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

export interface RunFitWorkerResult {
  output: WorkerOutput<FitData>
  costEur: number
}

export async function runFitWorker(
  input: AnalysisInput,
): Promise<RunFitWorkerResult> {
  const start = Date.now()
  logJson({
    event: "worker_fit_start",
    productName: input.productName,
    userImageExperience: input.userImageExperience,
    userVideoExperience: input.userVideoExperience,
  })

  try {
    const result = await withTimeout(
      (signal) =>
        callClaude({
          model: "sonnet-4-5",
          system: buildSystemPrompt(),
          prompt: buildUserPrompt(input),
          tools: [REPORT_FIT_TOOL],
          toolChoice: { type: "tool", name: TOOL_NAME },
          maxTokens: 1500,
          signal,
        }),
      TIMEOUT_MS,
      "fit_worker",
    )

    for (const block of result.content) {
      if (block.type !== "tool_use") continue
      if (block.name !== TOOL_NAME) continue
      const parsed = FitToolInputSchema.safeParse(block.input)
      if (!parsed.success) {
        logJson({
          event: "worker_fit_invalid_tool_input",
          productName: input.productName,
          errors: parsed.error.flatten(),
        })
        return {
          output: makeFallbackOutput(input, "tool input validation failed"),
          costEur: result.usage.costEur,
        }
      }
      // Compongo FitData unendo i 3 campi qualitativi LLM con i campi
      // calcolati deterministicamente in codice.
      const gaps = computeCreativeGaps(input)
      const fitData: FitData = {
        ...parsed.data.data,
        minTestBudgetEur: MIN_TEST_BUDGET_EUR,
        creativeCapacityMatch: gaps.effectiveDistance < 1,
        imageGap: gaps.imageGap,
        videoGap: gaps.videoGap,
      }
      const { score, additionalWarnings } = computeFitScore(input, fitData)
      const output: WorkerOutput<FitData> = {
        score,
        data: fitData,
        evidence: parsed.data.evidence,
        warnings: [...parsed.data.warnings, ...additionalWarnings],
        dataAvailable: true,
        dataConfidence: parsed.data.dataConfidence,
      }
      logJson({
        event: "worker_fit_done",
        productName: input.productName,
        score,
        imageGap: gaps.imageGap,
        videoGap: gaps.videoGap,
        effectiveDistance: gaps.effectiveDistance,
        creativeCapacityMatch: fitData.creativeCapacityMatch,
        dataConfidence: output.dataConfidence,
        capApplied: additionalWarnings.length > 0,
        costEur: result.usage.costEur,
        durationMs: Date.now() - start,
      })
      return { output, costEur: result.usage.costEur }
    }

    logJson({
      event: "worker_fit_no_tool_call",
      productName: input.productName,
      reason: "model_did_not_call_report_fit",
      costEur: result.usage.costEur,
    })
    return {
      output: makeFallbackOutput(input, "model did not call report_fit"),
      costEur: result.usage.costEur,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logJson({
      event: "worker_fit_error",
      productName: input.productName,
      error: message,
      durationMs: Date.now() - start,
    })
    return {
      output: makeFallbackOutput(input, message),
      costEur: 0,
    }
  }
}
