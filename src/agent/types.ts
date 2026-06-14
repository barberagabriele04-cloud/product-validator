// Vocabolario tipato del progetto. Solo TypeScript, nessun import runtime.
// Ogni tipo qui DEVE avere un equivalente Zod in src/agent/schemas.ts.
// Vedi CONTEXT.md sezioni 3, 6.4, 6.5, 10.

// --- Pattern anti-allucinazione (CONTEXT.md sez. 6.4) ---

export type QuantitativeEstimate =
  | { type: "observed"; value: number; source: string }
  | {
      type: "estimated_range"
      min: number
      max: number
      rationale: string
      confidence: "low" | "medium" | "high"
    }
  | { type: "unknown"; reason: string }

export type DataConfidence = "high" | "medium" | "low" | "unknown"

// --- Input utente (CONTEXT.md sez. 10) ---

export type UserChannel =
  | "tiktok_shop"
  | "shopify_meta"
  | "shopify_tiktok"
  | "amazon_fba"
export type UserMarket = "IT" | "EU" | "US" | "GLOBAL"

/**
 * Livello di esperienza dell'utente su una specifica dimensione creative
 * (immagini o video). Sostituisce il vecchio `UserCreativeCapacity` a 3
 * livelli con un enum a 4 livelli più granulare.
 */
export type CreativeExperienceLevel =
  | "none"
  | "basic"
  | "intermediate"
  | "proven"

export interface AnalysisInput {
  productUrl?: string
  productName: string
  productDescription?: string
  productCogs?: number
  userBudget: number
  userChannel: UserChannel
  userMarket: UserMarket
  userImageExperience: CreativeExperienceLevel
  userVideoExperience: CreativeExperienceLevel
}

// --- Worker output base (CONTEXT.md sez. 3) ---

export interface WorkerOutput<T> {
  score: number
  data: T
  evidence: string[]
  warnings: string[]
  dataAvailable: boolean
  dataConfidence: DataConfidence
}

// --- D1: Demand (peso 20%) ---

export type TrendDirection = "rising" | "stable" | "declining" | "unknown"
export type SocialMomentum = "low" | "medium" | "high" | "unknown"

export interface DemandData {
  trendDirection: TrendDirection
  monthlySearchesEstimate: QuantitativeEstimate
  relatedRisingQueries: string[]
  socialMomentum: SocialMomentum
  problemAwarenessScore: number
  sourcesConsulted: string[]
}

// --- D2: Saturation (peso 20%) ---

export type CompetingStoresLevel =
  | "low"
  | "medium"
  | "high"
  | "saturated"
  | "unknown"
export type MarketEntryWindow = "open" | "narrowing" | "closed" | "unknown"

export interface SaturationData {
  activeAdsCount: QuantitativeEstimate
  avgAdRuntimeDays: QuantitativeEstimate
  competingStoresEstimate: CompetingStoresLevel
  dominantBrandsPresent: boolean | "unknown"
  dominantBrandsList: string[]
  marketEntryWindow: MarketEntryWindow
  sourcesConsulted: string[]
}

// --- D3: Economics (peso 30%) ---

export interface EconomicsData {
  estimatedCogs: QuantitativeEstimate
  suggestedRetailPrice: number
  grossMarginPct: number
  estimatedCpm: number
  estimatedCpa: number
  breakevenRoas: number
  profitableAtUserBudget: boolean
  expectedReturnRate: number
  categoryClassification: string
}

// --- D4: Fit (peso 15%) ---

export interface FitData {
  minTestBudgetEur: number
  recommendedChannel: UserChannel
  daysToValidate: number
  channelMatchScore: number
  creativeCapacityMatch: boolean
  /**
   * Distanza positiva = utente sotto il livello immagini richiesto dal canale.
   * 0 se ok o sopra. Esposto per debugging e per future simulation panel.
   */
  imageGap: number
  /**
   * Distanza positiva = utente sotto il livello video richiesto dal canale.
   * 0 se ok o sopra.
   */
  videoGap: number
}

// --- D5: Risk (peso 15%) ---
//
// Architettura: il worker risk produce DUE blocchi semanticamente distinti.
// - MarketRiskData: rischio sul mercato del prodotto (return rate, qualità,
//   sicurezza). Influenza lo score finale.
// - ComplianceFlag: rischio legale/normativo (categoria ristretta, trademark,
//   CE). NON influenza lo score finale — viene mostrato come banner separato
//   nel report. L'utente decide come gestirlo.

export type TrademarkRisk = "low" | "medium" | "high" | "unknown"
export type ComplianceSeverity = "none" | "warning" | "critical"

export interface MarketRiskData {
  /** Frazione 0-1 (es. 0.04 = 4%). */
  expectedReturnRate: number
  /** True se expectedReturnRate > soglia 20%. */
  expectedReturnIssues: boolean
  /** Problemi di sicurezza prodotto noti / recall. */
  productSafetyConcerns: boolean
  /** Segnalazioni di qualità nelle fonti consultate. */
  qualityIssuesReported: boolean
}

export interface ComplianceFlag {
  /**
   * Aggregato della gravità compliance:
   * - "none": tutto pulito, niente da segnalare.
   * - "warning": ci sono note ma non bloccanti (CE required, trademark medium).
   * - "critical": problema serio che blocca advertising o vendita
   *   (categoria ristretta, trademark high).
   */
  severity: ComplianceSeverity
  restrictedCategory: boolean
  /** Lista delle piattaforme dove la categoria è ristretta (es. ["meta","tiktok"]). */
  restrictedPlatforms: string[]
  trademarkRisk: TrademarkRisk
  /** Descrizione del rischio se trademarkRisk in {medium, high}, null altrimenti. */
  trademarkDetails: string | null
  /** True se la categoria richiede marcatura CE per import/vendita EU. */
  ceComplianceRequired: boolean
  /** Lista narrativa dei motivi che hanno determinato la severity. Vuoto se none. */
  reasons: string[]
}

export interface RiskData {
  marketRisk: MarketRiskData
  compliance: ComplianceFlag
}

// --- Final report (CONTEXT.md sez. 3 mappatura cromatica) ---

export type ReportColor =
  | "verde-acceso"
  | "verde"
  | "giallo"
  | "arancione"
  | "rosso"

export type DimensionKey =
  | "demand"
  | "saturation"
  | "economics"
  | "fit"
  | "risk"

export interface DimensionBreakdown {
  score: number
  summary: string
  dataConfidence: DataConfidence
}

/**
 * Dati economici strutturati esposti nel breakdown.economics del FinalReport.
 * Tutti i valori numerici già risolti (niente discriminated union qui): il
 * frontend può display-arli senza ulteriore parsing. Popolato dall'aggregator
 * SOLO quando workers.economics.dataAvailable === true.
 */
export interface EconomicsBreakdownData {
  estimatedCogs: number
  suggestedRetailPrice: number
  /** Frazione 0-1 (es. 0.75 per il 75%). */
  grossMarginPct: number
  /** EUR convertiti dai benchmark USD via USD_EUR. */
  estimatedCpm: number
  /** EUR. */
  estimatedCpa: number
  breakevenRoas: number
  profitableAtUserBudget: boolean
  /** Frazione 0-1 (es. 0.04 per il 4%). */
  expectedReturnRate: number
  categoryClassification: string
}

export interface EconomicsBreakdown extends DimensionBreakdown {
  data?: EconomicsBreakdownData
}

export interface FinalReport {
  score: number
  color: ReportColor
  verdict: string
  strengths: [string, string, string]
  risks: [string, string, string]
  recommendation: string
  breakdown: {
    demand: DimensionBreakdown
    saturation: DimensionBreakdown
    economics: EconomicsBreakdown
    fit: DimensionBreakdown
    /**
     * breakdown.risk descrive ora SOLO il market risk (return rate, qualità,
     * safety). Il compliance flag separato vive in `complianceAlert`.
     */
    risk: DimensionBreakdown
  }
  totalCostEur: number
  /**
   * Compliance flag separato dallo score di mercato. Sempre presente —
   * severity può essere "none" (tutto pulito), "warning" (note non
   * bloccanti) o "critical" (problema serio bloccante advertising/vendita).
   */
  complianceAlert: ComplianceFlag
  dataIntegrity: number
  dataConfidenceByDimension: Record<DimensionKey, DataConfidence>
}

// --- Search result (CONTEXT.md sez. 7 Layer 3) ---

export type SearchConfidence = "observed" | "inferred" | "uncertain"

export interface SearchFinding {
  claim: string
  source: string
  confidence: SearchConfidence
}

// "live" = chiamata Claude appena eseguita; "cache" = hit su cache.ts.
export type SearchSource = "live" | "cache"

export interface SearchResult {
  query: string
  findings: SearchFinding[]
  notFound: string[]
  costEur: number
  source: SearchSource
}
