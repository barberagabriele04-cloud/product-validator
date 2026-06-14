import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import type { AnalysisInput } from "@/agent/types"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await ctx.params

  const analysis = await prisma.analysis.findUnique({
    where: { id: jobId },
  })

  if (analysis === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let parsedResult: unknown = null
  if (analysis.result !== null) {
    try {
      parsedResult = JSON.parse(analysis.result)
    } catch {
      // Risultato corrotto: lasciamo null e segnaliamo via errorMessage virtuale.
      parsedResult = null
    }
  }

  // Ricomponiamo l'AnalysisInput originale dai campi persistiti su Analysis.
  // Il frontend (report page) lo usa per mostrare il riepilogo prodotto+setup
  // senza dover fare una seconda chiamata.
  const input: AnalysisInput = {
    productUrl: analysis.productUrl ?? undefined,
    productName: analysis.productName,
    productDescription: analysis.productDescription ?? undefined,
    productCogs: analysis.productCogs ?? undefined,
    userBudget: analysis.userBudget,
    userChannel: analysis.userChannel as AnalysisInput["userChannel"],
    userMarket: analysis.userMarket as AnalysisInput["userMarket"],
    userImageExperience:
      analysis.userImageExperience as AnalysisInput["userImageExperience"],
    userVideoExperience:
      analysis.userVideoExperience as AnalysisInput["userVideoExperience"],
  }

  return NextResponse.json({
    jobId: analysis.id,
    status: analysis.status,
    result: parsedResult,
    errorMessage: analysis.errorMessage,
    totalCostEur: analysis.totalCostEur,
    createdAt: analysis.createdAt,
    startedAt: analysis.startedAt,
    completedAt: analysis.completedAt,
    input,
  })
}
