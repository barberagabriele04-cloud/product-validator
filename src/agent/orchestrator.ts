// Orchestrator full Phase 3: esegue 5 worker in parallelo via Promise.allSettled,
// poi chiama aggregator per produrre il FinalReport.
//
// Ogni worker degrada internamente in caso di errore/timeout. La doppia rete
// di Promise.allSettled è un guardrail per errori di infrastruttura.

import { prisma } from "@/lib/db"
import { runDemandWorker } from "@/agent/workers/demand"
import { runSaturationWorker } from "@/agent/workers/saturation"
import { runEconomicsWorker } from "@/agent/workers/economics"
import { runFitWorker } from "@/agent/workers/fit"
import { runRiskWorker } from "@/agent/workers/risk"
import { runAggregator } from "@/agent/aggregator"
import type {
  AnalysisInput,
  DemandData,
  EconomicsData,
  FitData,
  RiskData,
  SaturationData,
  WorkerOutput,
} from "@/agent/types"

function logJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

function fallbackDemand(reason: string): WorkerOutput<DemandData> {
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
    warnings: [`Orchestrator fallback demand: ${reason}`],
    dataAvailable: false,
    dataConfidence: "unknown",
  }
}

function fallbackSaturation(reason: string): WorkerOutput<SaturationData> {
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
    warnings: [`Orchestrator fallback saturation: ${reason}`],
    dataAvailable: false,
    dataConfidence: "unknown",
  }
}

function fallbackEconomics(reason: string): WorkerOutput<EconomicsData> {
  return {
    score: 50,
    data: {
      estimatedCogs: { type: "unknown", reason },
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
    warnings: [`Orchestrator fallback economics: ${reason}`],
    dataAvailable: false,
    dataConfidence: "unknown",
  }
}

function fallbackFit(
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
    warnings: [`Orchestrator fallback fit: ${reason}`],
    dataAvailable: false,
    dataConfidence: "unknown",
  }
}

function fallbackRisk(reason: string): WorkerOutput<RiskData> {
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
    warnings: [`Orchestrator fallback risk: ${reason}`],
    dataAvailable: false,
    dataConfidence: "unknown",
  }
}

function reasonFromSettled(s: PromiseSettledResult<unknown>): string {
  if (s.status === "fulfilled") return ""
  const r = s.reason
  return r instanceof Error ? r.message : String(r)
}

interface WorkerLanding<T> {
  output: WorkerOutput<T>
  costEur: number
}

function landWorker<T>(
  settled: PromiseSettledResult<WorkerLanding<T>> | undefined,
  workerName: string,
  jobId: string,
  fallback: () => WorkerOutput<T>,
): WorkerLanding<T> {
  if (settled === undefined) {
    const reason = "missing_settled_entry"
    logJson({
      event: `worker_${workerName}_unexpected_failure`,
      jobId,
      reason,
    })
    return { output: fallback(), costEur: 0 }
  }
  if (settled.status === "fulfilled") {
    return settled.value
  }
  const reason = reasonFromSettled(settled)
  logJson({
    event: `worker_${workerName}_unexpected_rejection`,
    jobId,
    reason,
  })
  return { output: fallback(), costEur: 0 }
}

export async function runAnalysis(
  input: AnalysisInput,
  jobId: string,
): Promise<void> {
  const orchestratorStart = Date.now()
  logJson({ event: "orchestrator_start", jobId, productName: input.productName })

  try {
    await prisma.analysis.update({
      where: { id: jobId },
      data: { status: "running", startedAt: new Date() },
    })

    const [
      demandSettled,
      saturationSettled,
      economicsSettled,
      fitSettled,
      riskSettled,
    ] = await Promise.allSettled([
      runDemandWorker(input),
      runSaturationWorker(input),
      runEconomicsWorker(input),
      runFitWorker(input),
      runRiskWorker(input),
    ])

    const demand = landWorker(demandSettled, "demand", jobId, () =>
      fallbackDemand(reasonFromSettled(demandSettled)),
    )
    const saturation = landWorker(saturationSettled, "saturation", jobId, () =>
      fallbackSaturation(reasonFromSettled(saturationSettled)),
    )
    const economics = landWorker(economicsSettled, "economics", jobId, () =>
      fallbackEconomics(reasonFromSettled(economicsSettled)),
    )
    const fit = landWorker(fitSettled, "fit", jobId, () =>
      fallbackFit(input, reasonFromSettled(fitSettled)),
    )
    const risk = landWorker(riskSettled, "risk", jobId, () =>
      fallbackRisk(reasonFromSettled(riskSettled)),
    )

    const workersCostEur =
      demand.costEur +
      saturation.costEur +
      economics.costEur +
      fit.costEur +
      risk.costEur

    logJson({
      event: "orchestrator_workers_done",
      jobId,
      workersCostEur,
      scores: {
        demand: demand.output.score,
        saturation: saturation.output.score,
        economics: economics.output.score,
        fit: fit.output.score,
        risk: risk.output.score,
      },
      dataAvailable: {
        demand: demand.output.dataAvailable,
        saturation: saturation.output.dataAvailable,
        economics: economics.output.dataAvailable,
        fit: fit.output.dataAvailable,
        risk: risk.output.dataAvailable,
      },
    })

    const { report } = await runAggregator({
      input,
      workers: {
        demand: demand.output,
        saturation: saturation.output,
        economics: economics.output,
        fit: fit.output,
        risk: risk.output,
      },
      workersCostEur,
    })

    await prisma.analysis.update({
      where: { id: jobId },
      data: {
        status: "completed",
        result: JSON.stringify(report),
        totalCostEur: report.totalCostEur,
        dataIntegrity: report.dataIntegrity,
        completedAt: new Date(),
      },
    })

    logJson({
      event: "orchestrator_complete",
      jobId,
      finalScore: report.score,
      color: report.color,
      complianceSeverity: report.complianceAlert.severity,
      dataIntegrity: report.dataIntegrity,
      totalCostEur: report.totalCostEur,
      durationMs: Date.now() - orchestratorStart,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logJson({ event: "orchestrator_error", jobId, error: message })
    try {
      await prisma.analysis.update({
        where: { id: jobId },
        data: {
          status: "failed",
          errorMessage: message,
          completedAt: new Date(),
        },
      })
    } catch (dbErr) {
      const dbMessage =
        dbErr instanceof Error ? dbErr.message : String(dbErr)
      logJson({
        event: "orchestrator_db_failed_update_error",
        jobId,
        error: dbMessage,
      })
    }
  }
}
