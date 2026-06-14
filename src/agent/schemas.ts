// Schemi Zod corrispondenti uno-a-uno ai tipi in src/agent/types.ts.
// In coda al file ci sono compile-time parity guards che falliscono
// la compilazione se schema e tipo divergono.

import { z } from "zod"
import type {
  AnalysisInput,
  ComplianceFlag,
  DataConfidence,
  DemandData,
  DimensionBreakdown,
  EconomicsBreakdown,
  EconomicsBreakdownData,
  EconomicsData,
  FinalReport,
  FitData,
  MarketRiskData,
  QuantitativeEstimate,
  RiskData,
  SaturationData,
  SearchFinding,
  SearchResult,
  WorkerOutput,
} from "@/agent/types"

// --- Pattern anti-allucinazione (CONTEXT.md sez. 6.4) ---

export const QuantitativeEstimateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("observed"),
    value: z.number(),
    source: z.string(),
  }),
  z.object({
    type: z.literal("estimated_range"),
    min: z.number(),
    max: z.number(),
    rationale: z.string(),
    confidence: z.enum(["low", "medium", "high"]),
  }),
  z.object({
    type: z.literal("unknown"),
    reason: z.string(),
  }),
])

export const DataConfidenceSchema = z.enum(["high", "medium", "low", "unknown"])

// --- Input utente ---

export const UserChannelSchema = z.enum([
  "tiktok_shop",
  "shopify_meta",
  "shopify_tiktok",
  "amazon_fba",
])
export const UserMarketSchema = z.enum(["IT", "EU", "US", "GLOBAL"])
export const CreativeExperienceLevelSchema = z.enum([
  "none",
  "basic",
  "intermediate",
  "proven",
])

export const AnalysisInputSchema = z.object({
  productUrl: z.string().optional(),
  productName: z.string().min(1),
  productDescription: z.string().optional(),
  productCogs: z.number().positive().optional(),
  userBudget: z.number().nonnegative(),
  userChannel: UserChannelSchema,
  userMarket: UserMarketSchema,
  userImageExperience: CreativeExperienceLevelSchema,
  userVideoExperience: CreativeExperienceLevelSchema,
})

// --- Worker output base ---

export function makeWorkerOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    score: z.number().min(0).max(100),
    data: dataSchema,
    evidence: z.array(z.string()),
    warnings: z.array(z.string()),
    dataAvailable: z.boolean(),
    dataConfidence: DataConfidenceSchema,
  })
}

// --- D1: Demand ---

export const TrendDirectionSchema = z.enum([
  "rising",
  "stable",
  "declining",
  "unknown",
])
export const SocialMomentumSchema = z.enum(["low", "medium", "high", "unknown"])

export const DemandDataSchema = z.object({
  trendDirection: TrendDirectionSchema,
  monthlySearchesEstimate: QuantitativeEstimateSchema,
  relatedRisingQueries: z.array(z.string()),
  socialMomentum: SocialMomentumSchema,
  problemAwarenessScore: z.number().min(0).max(100),
  sourcesConsulted: z.array(z.string()),
})

// --- D2: Saturation ---

export const CompetingStoresLevelSchema = z.enum([
  "low",
  "medium",
  "high",
  "saturated",
  "unknown",
])
export const MarketEntryWindowSchema = z.enum([
  "open",
  "narrowing",
  "closed",
  "unknown",
])

export const SaturationDataSchema = z.object({
  activeAdsCount: QuantitativeEstimateSchema,
  avgAdRuntimeDays: QuantitativeEstimateSchema,
  competingStoresEstimate: CompetingStoresLevelSchema,
  dominantBrandsPresent: z.union([z.boolean(), z.literal("unknown")]),
  dominantBrandsList: z.array(z.string()),
  marketEntryWindow: MarketEntryWindowSchema,
  sourcesConsulted: z.array(z.string()),
})

// --- D3: Economics ---

export const EconomicsDataSchema = z.object({
  estimatedCogs: QuantitativeEstimateSchema,
  suggestedRetailPrice: z.number().nonnegative(),
  grossMarginPct: z.number(),
  estimatedCpm: z.number().nonnegative(),
  estimatedCpa: z.number().nonnegative(),
  breakevenRoas: z.number().nonnegative(),
  profitableAtUserBudget: z.boolean(),
  expectedReturnRate: z.number().min(0).max(1),
  categoryClassification: z.string(),
})

// --- D4: Fit ---

export const FitDataSchema = z.object({
  minTestBudgetEur: z.number().nonnegative(),
  recommendedChannel: UserChannelSchema,
  daysToValidate: z.number().nonnegative(),
  channelMatchScore: z.number().min(0).max(100),
  creativeCapacityMatch: z.boolean(),
  imageGap: z.number(),
  videoGap: z.number(),
})

// --- D5: Risk ---

export const TrademarkRiskSchema = z.enum(["low", "medium", "high", "unknown"])
export const ComplianceSeveritySchema = z.enum([
  "none",
  "warning",
  "critical",
])

export const MarketRiskDataSchema = z.object({
  expectedReturnRate: z.number(),
  expectedReturnIssues: z.boolean(),
  productSafetyConcerns: z.boolean(),
  qualityIssuesReported: z.boolean(),
})

export const ComplianceFlagSchema = z.object({
  severity: ComplianceSeveritySchema,
  restrictedCategory: z.boolean(),
  restrictedPlatforms: z.array(z.string()),
  trademarkRisk: TrademarkRiskSchema,
  trademarkDetails: z.string().nullable(),
  ceComplianceRequired: z.boolean(),
  reasons: z.array(z.string()),
})

export const RiskDataSchema = z.object({
  marketRisk: MarketRiskDataSchema,
  compliance: ComplianceFlagSchema,
})

// --- Final report ---

export const ReportColorSchema = z.enum([
  "verde-acceso",
  "verde",
  "giallo",
  "arancione",
  "rosso",
])

export const DimensionKeySchema = z.enum([
  "demand",
  "saturation",
  "economics",
  "fit",
  "risk",
])

export const DimensionBreakdownSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  dataConfidence: DataConfidenceSchema,
})

// Dati economici strutturati esposti nel breakdown.economics. Numeri puri
// (niente discriminated union): valori già risolti dall'aggregator.
export const EconomicsBreakdownDataSchema = z.object({
  estimatedCogs: z.number(),
  suggestedRetailPrice: z.number(),
  grossMarginPct: z.number(),
  estimatedCpm: z.number(),
  estimatedCpa: z.number(),
  breakevenRoas: z.number(),
  profitableAtUserBudget: z.boolean(),
  expectedReturnRate: z.number(),
  categoryClassification: z.string(),
})

export const EconomicsBreakdownSchema = DimensionBreakdownSchema.extend({
  data: EconomicsBreakdownDataSchema.optional(),
})

const dimensionRecordSchema = <V extends z.ZodTypeAny>(value: V) =>
  z.object({
    demand: value,
    saturation: value,
    economics: value,
    fit: value,
    risk: value,
  })

export const FinalReportSchema = z.object({
  score: z.number().min(0).max(100),
  color: ReportColorSchema,
  verdict: z.string(),
  strengths: z.tuple([z.string(), z.string(), z.string()]),
  risks: z.tuple([z.string(), z.string(), z.string()]),
  recommendation: z.string(),
  breakdown: z.object({
    demand: DimensionBreakdownSchema,
    saturation: DimensionBreakdownSchema,
    economics: EconomicsBreakdownSchema,
    fit: DimensionBreakdownSchema,
    risk: DimensionBreakdownSchema,
  }),
  totalCostEur: z.number().nonnegative(),
  complianceAlert: ComplianceFlagSchema,
  dataIntegrity: z.number().min(0).max(1),
  dataConfidenceByDimension: dimensionRecordSchema(DataConfidenceSchema),
})

// --- Search result (web-search.ts) ---

export const SearchConfidenceSchema = z.enum([
  "observed",
  "inferred",
  "uncertain",
])

export const SearchFindingSchema = z.object({
  claim: z.string(),
  source: z.string(),
  confidence: SearchConfidenceSchema,
})

export const SearchSourceSchema = z.enum(["live", "cache"])

export const SearchResultSchema = z.object({
  query: z.string(),
  findings: z.array(SearchFindingSchema),
  notFound: z.array(z.string()),
  costEur: z.number().nonnegative(),
  source: SearchSourceSchema,
})

// =====================================================================
// Compile-time parity guards: types.ts ↔ schemas.ts.
// AssertEqual fallisce la compilazione se i due tipi non sono ESATTAMENTE
// equivalenti (controllo bidirezionale via conditional-type identity).
// =====================================================================

type AssertEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : never

const _guard_QuantitativeEstimate: AssertEqual<
  QuantitativeEstimate,
  z.infer<typeof QuantitativeEstimateSchema>
> = true
const _guard_DataConfidence: AssertEqual<
  DataConfidence,
  z.infer<typeof DataConfidenceSchema>
> = true
const _guard_AnalysisInput: AssertEqual<
  AnalysisInput,
  z.infer<typeof AnalysisInputSchema>
> = true
const _guard_DemandData: AssertEqual<
  DemandData,
  z.infer<typeof DemandDataSchema>
> = true
const _guard_SaturationData: AssertEqual<
  SaturationData,
  z.infer<typeof SaturationDataSchema>
> = true
const _guard_EconomicsData: AssertEqual<
  EconomicsData,
  z.infer<typeof EconomicsDataSchema>
> = true
const _guard_FitData: AssertEqual<FitData, z.infer<typeof FitDataSchema>> = true
const _guard_MarketRiskData: AssertEqual<
  MarketRiskData,
  z.infer<typeof MarketRiskDataSchema>
> = true
const _guard_ComplianceFlag: AssertEqual<
  ComplianceFlag,
  z.infer<typeof ComplianceFlagSchema>
> = true
const _guard_RiskData: AssertEqual<RiskData, z.infer<typeof RiskDataSchema>> =
  true
const _guard_DimensionBreakdown: AssertEqual<
  DimensionBreakdown,
  z.infer<typeof DimensionBreakdownSchema>
> = true
const _guard_EconomicsBreakdownData: AssertEqual<
  EconomicsBreakdownData,
  z.infer<typeof EconomicsBreakdownDataSchema>
> = true
const _guard_EconomicsBreakdown: AssertEqual<
  EconomicsBreakdown,
  z.infer<typeof EconomicsBreakdownSchema>
> = true
const _guard_FinalReport: AssertEqual<
  FinalReport,
  z.infer<typeof FinalReportSchema>
> = true
const _guard_SearchFinding: AssertEqual<
  SearchFinding,
  z.infer<typeof SearchFindingSchema>
> = true
const _guard_SearchResult: AssertEqual<
  SearchResult,
  z.infer<typeof SearchResultSchema>
> = true

// WorkerOutput è generico — verifichiamo lo shape con un dato dummy.
const _workerOutputProbe = makeWorkerOutputSchema(z.object({ x: z.number() }))
const _guard_WorkerOutput: AssertEqual<
  WorkerOutput<{ x: number }>,
  z.infer<typeof _workerOutputProbe>
> = true

// Riferimenti per silenziare "declared but never read" su strict.
void _guard_QuantitativeEstimate
void _guard_DataConfidence
void _guard_AnalysisInput
void _guard_DemandData
void _guard_SaturationData
void _guard_EconomicsData
void _guard_FitData
void _guard_MarketRiskData
void _guard_ComplianceFlag
void _guard_RiskData
void _guard_DimensionBreakdown
void _guard_EconomicsBreakdownData
void _guard_EconomicsBreakdown
void _guard_FinalReport
void _guard_SearchFinding
void _guard_SearchResult
void _guard_WorkerOutput
